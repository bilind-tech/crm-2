// CRUD für app_user mit Rollen-Logik.
import { randomUUID } from "node:crypto";
import { getDatabase } from "../db/index.js";
import { hashPassword } from "./password.js";
import { generateRecoveryCode, hashRecoveryCode, persistRecoveryHash } from "./recovery.js";

export type Rolle = "owner" | "mitarbeiter";

export interface BenutzerRow {
  id: string;
  username: string;
  rolle: Rolle;
  aktiv: number;
  createdAt: string;
  updatedAt: string;
  letzteAktivitaet: string | null;
  recoveryGesetzt: number;
}

export interface DbUserRow {
  id: string;
  username: string;
  password_hash: string;
  rolle: Rolle;
  recovery_hash: string | null;
  recovery_used_at: string | null;
  aktiv: number;
  letzte_aktivitaet: string | null;
  created_at: string;
  updated_at: string;
}

export function listeBenutzer(): BenutzerRow[] {
  return getDatabase()
    .prepare(
      `SELECT id, username, rolle, aktiv,
              created_at AS createdAt, updated_at AS updatedAt,
              letzte_aktivitaet AS letzteAktivitaet,
              CASE WHEN recovery_hash IS NULL THEN 0 ELSE 1 END AS recoveryGesetzt
         FROM app_user
        ORDER BY rolle DESC, username COLLATE NOCASE`,
    )
    .all() as BenutzerRow[];
}

export function findeBenutzer(id: string): DbUserRow | undefined {
  return getDatabase()
    .prepare(`SELECT * FROM app_user WHERE id = ?`)
    .get(id) as DbUserRow | undefined;
}

export function findeBenutzerByUsername(username: string): DbUserRow | undefined {
  return getDatabase()
    .prepare(`SELECT * FROM app_user WHERE username = ? COLLATE NOCASE`)
    .get(username) as DbUserRow | undefined;
}

export function aktiveOwnerAnzahl(): number {
  const r = getDatabase()
    .prepare(`SELECT COUNT(*) AS c FROM app_user WHERE rolle = 'owner' AND aktiv = 1`)
    .get() as { c: number };
  return r.c;
}

export interface AnlegenInput {
  username: string;
  rolle: Rolle;
  initialPasswort: string;
}

export interface AnlegenResult {
  id: string;
  username: string;
  rolle: Rolle;
  recoveryCode: string;
}

export async function legeBenutzerAn(input: AnlegenInput): Promise<AnlegenResult> {
  const exists = findeBenutzerByUsername(input.username);
  if (exists) {
    const e = new Error("username-conflict");
    (e as Error & { code?: string }).code = "username-conflict";
    throw e;
  }
  const id = randomUUID();
  const passwordHash = await hashPassword(input.initialPasswort);
  const recoveryCode = generateRecoveryCode();
  const recHash = await hashRecoveryCode(recoveryCode);
  getDatabase()
    .prepare(
      `INSERT INTO app_user (id, username, password_hash, rolle, recovery_hash, aktiv, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    )
    .run(id, input.username, passwordHash, input.rolle, recHash);
  return { id, username: input.username, rolle: input.rolle, recoveryCode };
}

export function setzeAktiv(id: string, aktiv: boolean): void {
  if (!aktiv) {
    const u = findeBenutzer(id);
    if (u?.rolle === "owner" && u.aktiv === 1 && aktiveOwnerAnzahl() <= 1) {
      const e = new Error("last-owner");
      (e as Error & { code?: string }).code = "last-owner";
      throw e;
    }
  }
  getDatabase()
    .prepare(`UPDATE app_user SET aktiv = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(aktiv ? 1 : 0, id);
}

export function setzeRolle(id: string, rolle: Rolle): void {
  if (rolle !== "owner") {
    const u = findeBenutzer(id);
    if (u?.rolle === "owner" && aktiveOwnerAnzahl() <= 1) {
      const e = new Error("last-owner");
      (e as Error & { code?: string }).code = "last-owner";
      throw e;
    }
  }
  getDatabase()
    .prepare(`UPDATE app_user SET rolle = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(rolle, id);
}

export async function setzeNeuesPasswort(id: string, neuesPasswort: string): Promise<void> {
  const ph = await hashPassword(neuesPasswort);
  getDatabase()
    .prepare(`UPDATE app_user SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(ph, id);
}

/** Erzeugt neuen Recovery-Code und persistiert dessen Hash. Liefert Klartext einmalig zurück. */
export async function rotiereRecovery(id: string): Promise<string> {
  const code = generateRecoveryCode();
  const h = await hashRecoveryCode(code);
  persistRecoveryHash(id, h);
  return code;
}
