// Generischer Settings-Store. Werte sind IMMER als JSON gespeichert.
// Sensible Werte werden vor dem Speichern AES-GCM-verschlüsselt.
//
// Bewusst OHNE In-Memory-Cache: SQLite-Read mit WAL+PK ist < 0.1ms.
// Cache hätte bei Multi-Worker (kommt später potentiell) Konsistenz-Probleme.

import { getDatabase } from "../db/index.js";
import { encryptString, decryptString } from "../crypto/aes.js";

interface Row {
  key: string;
  value: string;
  encrypted: number;
  updated_at: string;
}

function readRow(key: string): Row | undefined {
  return getDatabase()
    .prepare(`SELECT key, value, encrypted, updated_at FROM setting WHERE key = ?`)
    .get(key) as Row | undefined;
}

function decode(row: Row): unknown {
  const raw = row.encrypted ? decryptString(row.value) : row.value;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function getSetting<T = unknown>(key: string): T | undefined {
  const row = readRow(key);
  if (!row) return undefined;
  return decode(row) as T;
}

export function getSettingMeta(
  key: string,
): { exists: boolean; encrypted: boolean; updatedAt: string | null } {
  const row = readRow(key);
  if (!row) return { exists: false, encrypted: false, updatedAt: null };
  return { exists: true, encrypted: !!row.encrypted, updatedAt: row.updated_at };
}

export function setSetting(key: string, value: unknown, opts?: { encrypt?: boolean }): void {
  const json = JSON.stringify(value);
  const encrypt = !!opts?.encrypt;
  const stored = encrypt ? encryptString(json) : json;
  getDatabase()
    .prepare(
      `INSERT INTO setting (key, value, encrypted, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         encrypted = excluded.encrypted,
         updated_at = datetime('now')`,
    )
    .run(key, stored, encrypt ? 1 : 0);
}

export function deleteSetting(key: string): void {
  getDatabase().prepare(`DELETE FROM setting WHERE key = ?`).run(key);
}

export function listSettings(prefix: string): Array<{ key: string; value: unknown; encrypted: boolean; updatedAt: string }> {
  const rows = getDatabase()
    .prepare(`SELECT key, value, encrypted, updated_at FROM setting WHERE key LIKE ? ORDER BY key`)
    .all(`${prefix}%`) as Row[];
  return rows.map((r) => ({
    key: r.key,
    value: decode(r),
    encrypted: !!r.encrypted,
    updatedAt: r.updated_at,
  }));
}
