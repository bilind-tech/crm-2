// Tests für Owner-/Mitarbeiter-Rollen (Step 16).
// - Mitarbeiter bekommt 403 auf /system, /backup, /steuern, /benutzer
// - Owner darf alles
// - Letzter aktiver Owner kann nicht deaktiviert werden

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA = mkdtempSync(path.join(tmpdir(), "mcc-rollen-"));
process.env.DATA_DIR = DATA;
process.env.NODE_ENV = "development";
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";

const { default: Fastify } = await import("fastify");
const cookie = (await import("@fastify/cookie")).default;
const helmet = (await import("@fastify/helmet")).default;
const rateLimit = (await import("@fastify/rate-limit")).default;
const { openDatabase, closeDatabase } = await import("../src/db/index.js");
const { ensureMasterKey } = await import("../src/crypto/masterkey.js");
const { config } = await import("../src/config.js");
const { authRoutes } = await import("../src/routes/auth.js");
const { backupRoutes } = await import("../src/routes/backup.js");
const { systemRoutes } = await import("../src/routes/system.js");
const { steuernRoutes } = await import("../src/routes/steuern.js");
const { benutzerRoutes } = await import("../src/routes/benutzer.js");
const { warmTouchCacheFromDb } = await import("../src/auth/sessions.js");

let app: Awaited<ReturnType<typeof buildApp>>;
let ownerSess: string;
let mitarbeiterSess: string;
let mitarbeiterId: string;
let ownerId: string;

async function buildApp() {
  ensureMasterKey(config.keyPath);
  openDatabase(config.dbPath);
  const a = Fastify({ logger: false, trustProxy: true });
  await a.register(helmet, { contentSecurityPolicy: false });
  await a.register(cookie);
  await a.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await a.register(authRoutes);
  await a.register(backupRoutes);
  await a.register(systemRoutes);
  await a.register(steuernRoutes);
  await a.register(benutzerRoutes);
  warmTouchCacheFromDb();
  return a;
}

function getCookie(res: { cookies: Array<{ name: string; value: string }> }): string | undefined {
  return res.cookies.find((x) => x.name === "mcc_sess")?.value;
}

beforeAll(async () => {
  app = await buildApp();
  const tokenPath = path.join(DATA, "keys", "setup.token");
  const setupToken = JSON.parse(readFileSync(tokenPath, "utf8")).token;

  // Owner via Setup
  const setup = await app.inject({
    method: "POST",
    url: "/auth/setup",
    payload: { username: "owner", password: "Pa55wort!sicher#1", setupToken },
  });
  expect(setup.statusCode).toBe(200);
  ownerSess = getCookie(setup)!;
  ownerId = setup.json().userId ?? setup.json().id;

  // Mitarbeiter via Owner-Endpoint anlegen
  const created = await app.inject({
    method: "POST",
    url: "/benutzer",
    headers: { cookie: `mcc_sess=${ownerSess}` },
    payload: { username: "mita", rolle: "mitarbeiter" },
  });
  expect(created.statusCode).toBe(200);
  const initialPw = created.json().initialPasswort as string;
  mitarbeiterId = created.json().id as string;

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { "x-forwarded-for": "10.5.5.5" },
    payload: { username: "mita", password: initialPw },
  });
  expect(login.statusCode).toBe(200);
  mitarbeiterSess = getCookie(login)!;
});

afterAll(async () => {
  await app.close();
  closeDatabase();
  rmSync(DATA, { recursive: true, force: true });
});

describe("Mitarbeiter wird auf Owner-only Routen mit 403 abgewiesen", () => {
  const owOnly = [
    "/system/info",
    "/backup/status",
    "/steuern/einstellungen",
    "/benutzer",
  ];
  for (const url of owOnly) {
    it(`GET ${url} → 403 für Mitarbeiter`, async () => {
      const r = await app.inject({
        method: "GET",
        url,
        headers: { cookie: `mcc_sess=${mitarbeiterSess}` },
      });
      expect(r.statusCode).toBe(403);
    });
    it(`GET ${url} → != 403 für Owner`, async () => {
      const r = await app.inject({
        method: "GET",
        url,
        headers: { cookie: `mcc_sess=${ownerSess}` },
      });
      expect(r.statusCode).not.toBe(403);
    });
  }
});

describe("Last-Owner-Schutz", () => {
  it("Owner kann sich nicht selbst deaktivieren", async () => {
    const r = await app.inject({
      method: "PATCH",
      url: `/benutzer/${ownerId}`,
      headers: { cookie: `mcc_sess=${ownerSess}` },
      payload: { aktiv: false },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe("self-deactivate-forbidden");
  });

  it("Owner kann sich nicht selbst zum Mitarbeiter degradieren (last owner)", async () => {
    const r = await app.inject({
      method: "PATCH",
      url: `/benutzer/${ownerId}`,
      headers: { cookie: `mcc_sess=${ownerSess}` },
      payload: { rolle: "mitarbeiter" },
    });
    expect(r.statusCode).toBe(409);
  });

  it("Owner kann Mitarbeiter deaktivieren", async () => {
    const r = await app.inject({
      method: "PATCH",
      url: `/benutzer/${mitarbeiterId}`,
      headers: { cookie: `mcc_sess=${ownerSess}` },
      payload: { aktiv: false },
    });
    expect(r.statusCode).toBe(200);
  });
});
