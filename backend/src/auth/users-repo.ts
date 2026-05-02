// Single-User: minimaler Zugriff auf den einen app_user.
import { getDatabase } from "../db/index.js";
import { hashPassword } from "./password.js";
import { generateRecoveryCode, hashRecoveryCode, persistRecoveryHash } from "./recovery.js";

export interface DbUserRow {
  id: string;
  username: string;
  password_hash: string;
  recovery_hash: string | null;
  recovery_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export function findeBenutzer(id: string): DbUserRow | undefined {
  return getDatabase()
    .prepare(
      `SELECT id, username, password_hash, recovery_hash, recovery_used_at, created_at, updated_at
         FROM app_user WHERE id = ?`,
    )
    .get(id) as DbUserRow | undefined;
}

/** Liefert den (einen) Benutzer oder undefined. */
export function findeEinzigenBenutzer(): DbUserRow | undefined {
  return getDatabase()
    .prepare(
      `SELECT id, username, password_hash, recovery_hash, recovery_used_at, created_at, updated_at
         FROM app_user LIMIT 1`,
    )
    .get() as DbUserRow | undefined;
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
