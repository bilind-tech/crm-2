// Vitest-Suite für Step 1 Hardening.
// Läuft gegen frisches DataDir (tmp). Fastify wird ohne listen() benutzt (inject).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA = mkdtempSync(path.join(tmpdir(), "mcc-test-"));
process.env.DATA_DIR = DATA;
process.env.NODE_ENV = "development";
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";

// Wichtig: nach Env-Setup importieren
const { default: Fastify } = await import("fastify");
const cookie = (await import("@fastify/cookie")).default;
const helmet = (await import("@fastify/helmet")).default;
const rateLimit = (await import("@fastify/rate-limit")).default;
const { openDatabase, closeDatabase } = await import("../src/db/index.js");
const { ensureMasterKey } = await import("../src/crypto/masterkey.js");
const { config } = await import("../src/config.js");
const { authRoutes } = await import("../src/routes/auth.js");
const { einstellungenRoutes } = await import("../src/routes/einstellungen.js");
const { healthRoutes } = await import("../src/routes/health.js");
const { warmTouchCacheFromDb } = await import("../src/auth/sessions.js");

let app: Awaited<ReturnType<typeof buildApp>>;

async function buildApp() {
  ensureMasterKey(config.keyPath);
  openDatabase(config.dbPath);
  const a = Fastify({ logger: false });
  await a.register(helmet, { contentSecurityPolicy: false });
  await a.register(cookie);
  await a.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await a.register(healthRoutes);
  await a.register(authRoutes);
  await a.register(einstellungenRoutes);
  warmTouchCacheFromDb();
  return a;
}

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDatabase();
  rmSync(DATA, { recursive: true, force: true });
});

function getCookie(res: { cookies: Array<{ name: string; value: string }> }): string | undefined {
  const c = res.cookies.find((x) => x.name === "mcc_sess");
  return c?.value;
}

describe("Auth Hardening", () => {
  it("/auth/me liefert 409 needs-setup auf frischer DB", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("needs-setup");
  });

  it("Setup mit Token erstellt User & loggt ein", async () => {
    const tokenPath = path.join(DATA, "keys", "setup.token");
    const stored = JSON.parse(readFileSync(tokenPath, "utf8"));
    const res = await app.inject({
      method: "POST",
      url: "/auth/setup",
      payload: { username: "admin", password: "Pa55wort!sicher#1", setupToken: stored.token },
    });
    expect(res.statusCode).toBe(200);
    expect(getCookie(res)).toBeTruthy();
  });

  it("Login mit falschem Passwort: 401, KEINE Lockout-Daten in Antwort", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "admin", password: "falsch" },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe("invalid-credentials");
    expect(body.failCount).toBeUndefined();
    expect(body.lockedUntil).toBeUndefined();
    expect(body.locked).toBeUndefined();
  });

  it("Login mit nicht existierendem User: 401 mit gleichem Body wie falsches Passwort", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "ghost", password: "irgendwas" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("invalid-credentials");
  });

  it("5 Fehlversuche → 423 Locked", async () => {
    let last;
    for (let i = 0; i < 5; i++) {
      last = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { username: "admin", password: "falsch-x" },
      });
    }
    expect(last!.statusCode).toBe(423);
    expect(last!.json().lockedUntil).toBeTruthy();
  });
});

describe("Settings Patch-Semantik", () => {
  let sess: string;

  it("Korrekter Login holt Cookie", async () => {
    // Lockout aufheben: andere IP simulieren via X-Forwarded-For
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "x-forwarded-for": "10.9.9.9" },
      payload: { username: "admin", password: "Pa55wort!sicher#1" },
    });
    expect(res.statusCode).toBe(200);
    sess = getCookie(res)!;
    expect(sess).toBeTruthy();
  });

  it("PATCH firma {iban: ''} setzt iban auf leer (kein silent revert)", async () => {
    await app.inject({
      method: "PATCH",
      url: "/einstellungen/firma",
      headers: { cookie: `mcc_sess=${sess}` },
      payload: { name: "Test GmbH", iban: "DE123" },
    });
    const r2 = await app.inject({
      method: "PATCH",
      url: "/einstellungen/firma",
      headers: { cookie: `mcc_sess=${sess}` },
      payload: { iban: "" },
    });
    expect(r2.statusCode).toBe(200);
    const b = r2.json();
    expect(b.iban).toBe("");
    expect(b.name).toBe("Test GmbH");
  });

  it("PATCH smtp port als String '465' wird coerced", async () => {
    const r = await app.inject({
      method: "PATCH",
      url: "/einstellungen/smtp",
      headers: { cookie: `mcc_sess=${sess}` },
      payload: { port: "465", host: "smtp.test" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().port).toBe(465);
  });
});

describe("Sessions: Cross-User-Revoke verboten", () => {
  it("DELETE /sitzungen/:foreignToken liefert 404", async () => {
    // Login holen
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "x-forwarded-for": "10.8.8.8" },
      payload: { username: "admin", password: "Pa55wort!sicher#1" },
    });
    const cookieVal = getCookie(login)!;
    const r = await app.inject({
      method: "DELETE",
      url: "/einstellungen/sitzungen/totally-fake-token-xyz",
      headers: { cookie: `mcc_sess=${cookieVal}` },
    });
    expect(r.statusCode).toBe(404);
  });
});

describe("Setup-Token: nach Setup nicht mehr gültig", () => {
  it("Erneuter Setup-Versuch → 409 already-setup", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/setup",
      payload: { username: "admin2", password: "Pa55wort!sicher#1", setupToken: "x" },
    });
    expect(r.statusCode).toBe(409);
  });
});
