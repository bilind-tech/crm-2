// Vitest-Suite für Step 2 Backup & Restore.
// Läuft gegen frisches DataDir (tmp). Fastify per inject().

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as tar from "tar";

const DATA = mkdtempSync(path.join(tmpdir(), "mcc-backup-"));
process.env.DATA_DIR = DATA;
process.env.NODE_ENV = "development";
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";

const { default: Fastify } = await import("fastify");
const cookie = (await import("@fastify/cookie")).default;
const helmet = (await import("@fastify/helmet")).default;
const rateLimit = (await import("@fastify/rate-limit")).default;
const multipart = (await import("@fastify/multipart")).default;
const { openDatabase, closeDatabase, getDatabase } = await import("../src/db/index.js");
const { ensureMasterKey } = await import("../src/crypto/masterkey.js");
const { config } = await import("../src/config.js");
const { authRoutes } = await import("../src/routes/auth.js");
const { backupRoutes } = await import("../src/routes/backup.js");
const { healthRoutes } = await import("../src/routes/health.js");
const { createBackup } = await import("../src/backup/create.js");
const { listVisible } = await import("../src/backup/repo.js");
const { restoreFromArchive } = await import("../src/backup/restore.js");
const { rotate } = await import("../src/backup/rotation.js");
const { isMaintenance } = await import("../src/backup/maintenance.js");

let app: Awaited<ReturnType<typeof buildApp>>;

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true, mode: 0o700 });
}

async function buildApp() {
  ensureMasterKey(config.keyPath);
  openDatabase(config.dbPath);
  for (const d of [
    config.uploadsDir,
    config.backupsDir,
    config.backupsDailyDir,
    config.backupsWeeklyDir,
    config.backupsMonthlyDir,
    config.backupsSafetyDir,
    config.backupsTmpDir,
  ]) ensureDir(d);
  const a = Fastify({ logger: false, trustProxy: true });
  await a.register(helmet, { contentSecurityPolicy: false });
  await a.register(cookie);
  await a.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await a.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
  const { maintenanceGuard } = await import("../src/backup/maintenance.js");
  a.addHook("preHandler", maintenanceGuard);
  await a.register(healthRoutes);
  await a.register(authRoutes);
  await a.register(backupRoutes);
  return a;
}

async function setupAndLogin(): Promise<string> {
  const tokFile = path.join(config.dataDir, "keys", "setup.token");
  const tokRaw = readFileSync(tokFile, "utf8");
  const tokParsed = JSON.parse(tokRaw);
  const setupToken = tokParsed.token ?? tokParsed;

  const r = await app.inject({
    method: "POST",
    url: "/auth/setup",
    payload: { setupToken, username: "owner", password: "Sicheres-Passwort-1!" },
  });
  expect(r.statusCode).toBe(200);
  const cookieHeader = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return cookieHeader;
}

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDatabase();
  rmSync(DATA, { recursive: true, force: true });
});

describe("Backup & Restore", () => {
  let cookie = "";

  it("Setup + Login funktioniert (Vorbereitung)", async () => {
    cookie = await setupAndLogin();
    expect(cookie).toContain("mcc_sess=");
  });

  it("Snapshot enthält DB + uploads + master.key + manifest", async () => {
    writeFileSync(path.join(config.uploadsDir, "logo.png"), "FAKE-PNG");

    const result = await createBackup({ category: "manual", trigger: "manual" });
    expect(existsSync(result.fullPath)).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);

    const seen = new Set<string>();
    await tar.list({
      file: result.fullPath,
      onReadEntry: (e) => seen.add(e.path),
    });
    expect([...seen].some((p) => p.includes("manifest.json"))).toBe(true);
    expect([...seen].some((p) => p.includes("db/mycleancenter.db"))).toBe(true);
    expect([...seen].some((p) => p.includes("uploads/logo.png"))).toBe(true);
    expect([...seen].some((p) => p.includes("keys/master.key"))).toBe(true);
  });

  it("Sichtbarkeitsregel: nur fertige Backups in /backup/historie", async () => {
    const r = await app.inject({ method: "GET", url: "/backup/historie", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const arr = r.json() as Array<{ status: string; abgeschlossenAm: string | null }>;
    expect(arr.length).toBeGreaterThan(0);
    for (const e of arr) {
      expect(e.status).toBe("erfolg");
      expect(e.abgeschlossenAm).not.toBeNull();
    }
  });

  it("Manifest-Validation lehnt fremdes höheres Schema ab", async () => {
    const tmp = path.join(config.backupsTmpDir, "fake-build");
    ensureDir(tmp);
    ensureDir(path.join(tmp, "db"));
    writeFileSync(path.join(tmp, "db", "mycleancenter.db"), "x");
    writeFileSync(
      path.join(tmp, "manifest.json"),
      JSON.stringify({
        appVersion: "9.9.9",
        schemaVersion: 9999,
        createdAt: new Date().toISOString(),
        type: "manual",
        trigger: "manual",
        dbSha256: "deadbeef",
        includedDirs: ["db"],
        sizes: { dbBytes: 1, uploadsBytes: 0 },
      }),
    );
    const archive = path.join(config.backupsTmpDir, "evil.tar.gz");
    await tar.create({ gzip: true, file: archive, cwd: tmp }, ["manifest.json", "db"]);

    const res = await restoreFromArchive({ archivePath: archive });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Schema/i);
    expect(isMaintenance()).toBe(false);
  });

  it("Restore-Roundtrip stellt Daten wieder her", async () => {
    getDatabase().prepare(`INSERT INTO audit_log (action, detail) VALUES (?, ?)`).run(
      "test.marker",
      JSON.stringify({ phase: "before-backup" }),
    );

    const backup = await createBackup({ category: "manual", trigger: "manual" });
    expect(existsSync(backup.fullPath)).toBe(true);

    getDatabase().prepare(`DELETE FROM audit_log WHERE action = 'test.marker'`).run();
    const beforeRestore = getDatabase()
      .prepare(`SELECT COUNT(*) c FROM audit_log WHERE action = 'test.marker'`)
      .get() as { c: number };
    expect(beforeRestore.c).toBe(0);

    const r = await restoreFromArchive({ archivePath: backup.fullPath });
    expect(r.ok).toBe(true);
    expect(isMaintenance()).toBe(false);

    const afterRestore = getDatabase()
      .prepare(`SELECT COUNT(*) c FROM audit_log WHERE action = 'test.marker'`)
      .get() as { c: number };
    expect(afterRestore.c).toBeGreaterThan(0);
  });

  it("Kaputtes tar → Restore failed sauber, Sicherheits-Backup existiert, Wartungsmodus aus", async () => {
    const broken = path.join(config.backupsTmpDir, "broken.tar.gz");
    writeFileSync(broken, Buffer.from("nicht wirklich gzip"));
    const safetyBefore = listVisible().filter((b) => b.category === "pre-restore").length;
    const r = await restoreFromArchive({ archivePath: broken });
    expect(r.ok).toBe(false);
    expect(isMaintenance()).toBe(false);
    const safetyAfter = listVisible().filter((b) => b.category === "pre-restore").length;
    expect(safetyAfter).toBe(safetyBefore + 1);
  });

  it("Rotation entfernt überzählige Daily-Backups", async () => {
    for (let i = 0; i < 3; i++) {
      await createBackup({ category: "daily", trigger: "auto" });
    }
    const r = rotate();
    expect(r.trimmed.daily).toBe(0);
  });

  it("Geplante Backups dürfen nicht manuell gelöscht werden", async () => {
    const dailies = listVisible().filter((b) => b.category === "daily");
    expect(dailies.length).toBeGreaterThan(0);
    const r = await app.inject({
      method: "DELETE",
      url: `/backup/${dailies[0].id}`,
      headers: { cookie },
    });
    expect(r.statusCode).toBe(409);
  });

  it("Restore-Endpoint lehnt ohne Passwort ab (401)", async () => {
    const visible = listVisible();
    expect(visible.length).toBeGreaterThan(0);
    const r = await app.inject({
      method: "POST",
      url: `/backup/${visible[0].id}/restore`,
      payload: {},
      headers: { cookie },
    });
    expect(r.statusCode).toBe(401);
  });

  it("Health/detail meldet Backup-Status", async () => {
    const r = await app.inject({ method: "GET", url: "/health/detail", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const j = r.json() as { backup: { lastAt: string | null; lastOk: boolean | null }; maintenance: { active: boolean } };
    expect(j.backup.lastAt).not.toBeNull();
    expect(j.backup.lastOk).toBe(true);
    expect(j.maintenance.active).toBe(false);
  });

  it("Restore-Status-Endpoint ist auth-frei (für Wartungsmodus)", async () => {
    const r = await app.inject({ method: "GET", url: "/backup/restore-status" });
    expect(r.statusCode).toBe(200);
    const j = r.json() as { restore: unknown; maintenance: { active: boolean } };
    expect(j).toHaveProperty("restore");
    expect(j).toHaveProperty("maintenance");
  });
});
