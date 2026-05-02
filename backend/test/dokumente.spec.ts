// Step 12 — Dokumente + Upload-Sessions Backend-Tests.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA = mkdtempSync(path.join(tmpdir(), "mcc-dok-data-"));
const APP = mkdtempSync(path.join(tmpdir(), "mcc-dok-app-"));
process.env.DATA_DIR = DATA;
process.env.APP_ROOT = APP;
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
const { dokumenteRoutes } = await import("../src/routes/dokumente.js");
const { runFristCheck } = await import("../src/dokumente/fristen-cron.js");

let app: Awaited<ReturnType<typeof buildApp>>;
let cookieHeader = "";

const PNG_BYTES = Buffer.from(
  // 1x1 transparent PNG
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

function ensureDir(p: string) { if (!existsSync(p)) mkdirSync(p, { recursive: true, mode: 0o700 }); }

async function buildApp() {
  ensureMasterKey(config.keyPath);
  openDatabase(config.dbPath);
  for (const d of [config.uploadsDir, config.backupsDir, config.logsDir]) ensureDir(d);
  const a = Fastify({ logger: { level: "error" }, trustProxy: true });
  await a.register(helmet, { contentSecurityPolicy: false });
  await a.register(cookie);
  await a.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await a.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
  await a.register(authRoutes);
  await a.register(dokumenteRoutes);
  return a;
}

async function setupAndLogin(): Promise<string> {
  const tokFile = path.join(config.dataDir, "keys", "setup.token");
  const tokRaw = readFileSync(tokFile, "utf8");
  const tokParsed = JSON.parse(tokRaw);
  const setupToken = tokParsed.token ?? tokParsed;
  const r = await app.inject({
    method: "POST", url: "/auth/setup",
    payload: { setupToken, password: "Sicheres-Passwort-1!" },
  });
  expect(r.statusCode).toBe(200);
  return r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Erzeugt einen Multipart-Request-Body. */
function multipartBody(opts: {
  file: Buffer;
  filename: string;
  mimeType: string;
  meta?: Record<string, unknown>;
}): { body: Buffer; contentType: string } {
  const boundary = "----mccTest" + Math.random().toString(16).slice(2);
  const CRLF = "\r\n";
  const parts: Buffer[] = [];
  if (opts.meta) {
    parts.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="meta"${CRLF}${CRLF}` +
      JSON.stringify(opts.meta) + CRLF,
    ));
  }
  parts.push(Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${opts.filename}"${CRLF}` +
    `Content-Type: ${opts.mimeType}${CRLF}${CRLF}`,
  ));
  parts.push(opts.file);
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  cookieHeader = await setupAndLogin();
});

afterAll(async () => {
  await app.close();
  closeDatabase();
  rmSync(DATA, { recursive: true, force: true });
  rmSync(APP, { recursive: true, force: true });
});

describe("Dokumente — CRUD + Multipart", () => {
  let createdId = "";

  it("POST ohne Auth → 401", async () => {
    const mp = multipartBody({ file: PNG_BYTES, filename: "x.png", mimeType: "image/png" });
    const r = await app.inject({ method: "POST", url: "/dokumente", payload: mp.body, headers: { "content-type": mp.contentType } });
    expect(r.statusCode).toBe(401);
  });

  it("POST PNG legt Dokument an", async () => {
    const mp = multipartBody({
      file: PNG_BYTES, filename: "scan.png", mimeType: "image/png",
      meta: { titel: "Test-Scan", typ: "beleg", steuerrelevant: true, faelligAm: "2026-12-01" },
    });
    const r = await app.inject({
      method: "POST", url: "/dokumente",
      payload: mp.body, headers: { "content-type": mp.contentType, cookie: cookieHeader },
    });
    expect(r.statusCode).toBe(201);
    const j = r.json();
    expect(j.id).toMatch(/^dok-/);
    expect(j.titel).toBe("Test-Scan");
    expect(j.typ).toBe("beleg");
    expect(j.steuerrelevant).toBe(true);
    expect(j.url).toBe(`/dokumente/${j.id}/datei`);
    expect(j.sha256).toMatch(/^[0-9a-f]{64}$/);
    createdId = j.id;
  });

  it("POST PDF wird als 'rechnung' klassifiziert wenn typ leer", async () => {
    const mp = multipartBody({ file: PDF_BYTES, filename: "rg.pdf", mimeType: "application/pdf" });
    const r = await app.inject({
      method: "POST", url: "/dokumente",
      payload: mp.body, headers: { "content-type": mp.contentType, cookie: cookieHeader },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().typ).toBe("rechnung");
  });

  it("POST Dedup — gleiche Datei → gleicher sha256, neue Zeile", async () => {
    const mp = multipartBody({ file: PNG_BYTES, filename: "scan2.png", mimeType: "image/png" });
    const r = await app.inject({
      method: "POST", url: "/dokumente",
      payload: mp.body, headers: { "content-type": mp.contentType, cookie: cookieHeader },
    });
    expect(r.statusCode).toBe(201);
    const j = r.json();
    const first = await app.inject({ method: "GET", url: `/dokumente/${createdId}`, headers: { cookie: cookieHeader } });
    expect(j.sha256).toBe(first.json().sha256);
  });

  it("POST MIME nicht erlaubt (text/plain) → 415", async () => {
    const mp = multipartBody({ file: Buffer.from("hello"), filename: "h.txt", mimeType: "text/plain" });
    const r = await app.inject({
      method: "POST", url: "/dokumente",
      payload: mp.body, headers: { "content-type": mp.contentType, cookie: cookieHeader },
    });
    expect(r.statusCode).toBe(415);
  });

  it("POST ohne Multipart → 400", async () => {
    const r = await app.inject({
      method: "POST", url: "/dokumente",
      payload: { foo: 1 }, headers: { cookie: cookieHeader },
    });
    expect(r.statusCode).toBe(400);
  });

  it("GET Liste — Filter kundeId/typ", async () => {
    const r = await app.inject({ method: "GET", url: "/dokumente?typ=beleg", headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);
    const list = r.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.every((d: { typ: string }) => d.typ === "beleg")).toBe(true);
  });

  it("GET Datei liefert Stream mit korrektem Content-Type", async () => {
    const r = await app.inject({ method: "GET", url: `/dokumente/${createdId}/datei`, headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toBe("image/png");
    expect(r.rawPayload.length).toBe(PNG_BYTES.length);
  });

  it("PATCH ändert Titel + steuerrelevant", async () => {
    const r = await app.inject({
      method: "PATCH", url: `/dokumente/${createdId}`,
      headers: { cookie: cookieHeader }, payload: { titel: "Umbenannt", steuerrelevant: false },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().titel).toBe("Umbenannt");
    expect(r.json().steuerrelevant).toBe(false);
  });

  it("Erledigt-Toggle setzt + entfernt erledigtAm", async () => {
    const a = await app.inject({
      method: "POST", url: `/dokumente/${createdId}/erledigt`,
      headers: { cookie: cookieHeader }, payload: { erledigt: true },
    });
    expect(a.json().erledigtAm).toBeTruthy();
    const b = await app.inject({
      method: "POST", url: `/dokumente/${createdId}/erledigt`,
      headers: { cookie: cookieHeader }, payload: { erledigt: false },
    });
    expect(b.json().erledigtAm).toBeNull();
  });

  it("DELETE → 204, nicht mehr in Liste, raw-Zeile geloescht_am gesetzt", async () => {
    const r = await app.inject({ method: "DELETE", url: `/dokumente/${createdId}`, headers: { cookie: cookieHeader } });
    expect(r.statusCode).toBe(204);
    const g = await app.inject({ method: "GET", url: `/dokumente/${createdId}`, headers: { cookie: cookieHeader } });
    expect(g.statusCode).toBe(404);
    const row = getDatabase().prepare("SELECT geloescht_am FROM dokumente WHERE id=?").get(createdId) as { geloescht_am: string | null };
    expect(row.geloescht_am).toBeTruthy();
  });
});

describe("Upload-Sessions (Handy-Scan)", () => {
  let token = "";
  let sessId = "";

  it("POST /upload-sessions → 201 mit Token", async () => {
    const r = await app.inject({
      method: "POST", url: "/upload-sessions",
      headers: { cookie: cookieHeader }, payload: {},
    });
    expect(r.statusCode).toBe(201);
    const j = r.json();
    expect(j.token).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(j.beendet).toBe(false);
    token = j.token;
    sessId = j.id;
  });

  it("GET /upload-sessions/:token (ohne Auth) → 200", async () => {
    const r = await app.inject({ method: "GET", url: `/upload-sessions/${token}` });
    expect(r.statusCode).toBe(200);
    expect(r.json().token).toBe(token);
  });

  it("POST /upload-sessions/:token/dokumente (ohne Auth, nur Token) → 201", async () => {
    const mp = multipartBody({ file: PNG_BYTES, filename: "handy.png", mimeType: "image/png" });
    const r = await app.inject({
      method: "POST", url: `/upload-sessions/${token}/dokumente`,
      payload: mp.body, headers: { "content-type": mp.contentType },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().quelle).toBe("handy-scan");
  });

  it("Session-Detail listet hochgeladenes Dokument", async () => {
    const r = await app.inject({ method: "GET", url: `/upload-sessions/${token}` });
    expect(r.json().dokumentIds.length).toBe(1);
  });

  it("POST beenden → Session blockiert weitere Uploads", async () => {
    const e = await app.inject({
      method: "POST", url: `/upload-sessions/${sessId}/beenden`, headers: { cookie: cookieHeader },
    });
    expect(e.statusCode).toBe(204);
    const mp = multipartBody({ file: PNG_BYTES, filename: "x.png", mimeType: "image/png" });
    const r = await app.inject({
      method: "POST", url: `/upload-sessions/${token}/dokumente`,
      payload: mp.body, headers: { "content-type": mp.contentType },
    });
    expect(r.statusCode).toBe(410);
  });

  it("Unbekannter Token → 404", async () => {
    const r = await app.inject({ method: "GET", url: `/upload-sessions/does-not-exist` });
    expect(r.statusCode).toBe(404);
  });
});

describe("Frist-Cron", () => {
  it("erzeugt Benachrichtigung für überfälliges Dokument, nur einmal pro Tag", async () => {
    // Dokument mit Vergangenheits-Frist anlegen
    const mp = multipartBody({
      file: PDF_BYTES, filename: "frist.pdf", mimeType: "application/pdf",
      meta: { titel: "Steuerfrist", faelligAm: "2020-01-01" },
    });
    const c = await app.inject({
      method: "POST", url: "/dokumente",
      payload: mp.body, headers: { "content-type": mp.contentType, cookie: cookieHeader },
    });
    expect(c.statusCode).toBe(201);

    const before = (getDatabase().prepare("SELECT COUNT(*) AS n FROM benachrichtigung").get() as { n: number }).n;
    const a = runFristCheck();
    expect(a.benachrichtigt).toBeGreaterThanOrEqual(1);
    const after1 = (getDatabase().prepare("SELECT COUNT(*) AS n FROM benachrichtigung").get() as { n: number }).n;
    expect(after1).toBeGreaterThan(before);

    // Zweiter Lauf darf KEINE neuen anlegen (Dedup pro Tag)
    const b = runFristCheck();
    const after2 = (getDatabase().prepare("SELECT COUNT(*) AS n FROM benachrichtigung").get() as { n: number }).n;
    expect(after2).toBe(after1);
    expect(b.uebersprungen).toBeGreaterThanOrEqual(a.benachrichtigt);
  });
});
