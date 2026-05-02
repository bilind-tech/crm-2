// Restore-Flow:
//   1. Sicherheits-Backup (pre-restore)
//   2. Wartungsmodus an
//   3. tar.gz nach tmp/restore-<id>/ entpacken
//   4. Manifest validieren (kein Schema-Downgrade)
//   5. DB sauber schließen
//   6. Atomarer Swap von db/, uploads/, keys/ — alte Stände nach tmp/restore-<id>/old/
//   7. DB neu öffnen → Migrationen
//   8. Wartungsmodus aus
//
// Bei jedem Fehler ab Schritt 6: Rollback aus old/, Wartungsmodus bleibt an.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import * as tar from "tar";
import { config } from "../config.js";
import {
  closeDatabase,
  getSchemaVersion,
  openDatabase,
} from "../db/index.js";
import { audit } from "../auth/audit.js";
import { parseManifest } from "./manifest.js";
import { createBackup } from "./create.js";
import {
  enterMaintenance,
  leaveMaintenance,
} from "./maintenance.js";
import {
  finishRestoreProgress,
  setRestorePhase,
  startRestoreProgress,
} from "./progress.js";

const RESTORE_TMP_PREFIX = "restore-";

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true, mode: 0o700 });
}

function safeRm(p: string): void {
  try {
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

/** Atomarer Verzeichnis-Swap: aktueller Stand → old, neuer Stand → live. */
function swapDir(live: string, fresh: string, oldBackup: string): void {
  if (existsSync(live)) {
    renameSync(live, oldBackup);
  }
  renameSync(fresh, live);
}

function rollbackSwap(live: string, oldBackup: string): void {
  try {
    safeRm(live);
    if (existsSync(oldBackup)) renameSync(oldBackup, live);
  } catch (e) {
    audit({ action: "restore.rollback.fail", detail: { live, error: String(e) } });
  }
}

export interface RestoreOptions {
  archivePath: string;
  triggeredBy?: string | null;
}

export async function restoreFromArchive(opts: RestoreOptions): Promise<{ ok: true } | { ok: false; error: string }> {
  const restoreId = `${Date.now()}`;
  startRestoreProgress(restoreId);

  // --- 1. Sicherheits-Backup ---
  setRestorePhase("safety-backup", 5, "Sicherheits-Backup wird erstellt");
  try {
    await createBackup({ category: "pre-restore", trigger: "pre-restore" });
  } catch (e) {
    const msg = "Sicherheits-Backup fehlgeschlagen: " + (e instanceof Error ? e.message : String(e));
    finishRestoreProgress(false, msg, msg);
    audit({ action: "restore.abort", detail: { stage: "safety-backup", error: msg } });
    return { ok: false, error: msg };
  }

  // --- 2. Wartungsmodus ---
  enterMaintenance("Restore läuft");

  const workDir = path.join(config.backupsTmpDir, RESTORE_TMP_PREFIX + restoreId);
  const oldDir = path.join(workDir, "old");
  ensureDir(workDir);
  ensureDir(oldDir);

  let didDbClose = false;
  let dbSwapped = false;
  let uploadsSwapped = false;
  let keysSwapped = false;

  try {
    // --- 3. Entpacken ---
    setRestorePhase("extract", 20, "Archiv entpacken");
    if (!existsSync(opts.archivePath) || statSync(opts.archivePath).size === 0) {
      throw new Error("Backup-Datei nicht gefunden oder leer");
    }
    await tar.extract({ file: opts.archivePath, cwd: workDir });

    // --- 4. Manifest validieren ---
    setRestorePhase("validate", 35, "Manifest prüfen");
    const manifestPath = path.join(workDir, "manifest.json");
    if (!existsSync(manifestPath)) throw new Error("Manifest fehlt im Backup");
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    const parsed = parseManifest(raw);
    if (!parsed.ok) throw new Error("Manifest ungültig: " + parsed.error);

    const currentSchema = getSchemaVersion();
    if (parsed.manifest.schemaVersion > currentSchema) {
      throw new Error(
        `Backup hat neueres Schema (${parsed.manifest.schemaVersion}) als das laufende System (${currentSchema}). Downgrade nicht erlaubt.`,
      );
    }

    const freshDb = path.join(workDir, "db");
    const freshUploads = path.join(workDir, "uploads");
    const freshKeys = path.join(workDir, "keys");
    if (!existsSync(freshDb)) throw new Error("db/ fehlt im Backup");

    // --- 5. DB schließen ---
    setRestorePhase("swap", 50, "Datenbank schließen");
    closeDatabase();
    didDbClose = true;

    // --- 6. Atomar swappen ---
    setRestorePhase("swap", 60, "Daten ersetzen");
    swapDir(config.dbDir, freshDb, path.join(oldDir, "db"));
    dbSwapped = true;

    if (existsSync(freshUploads)) {
      swapDir(config.uploadsDir, freshUploads, path.join(oldDir, "uploads"));
      uploadsSwapped = true;
    }

    if (existsSync(freshKeys)) {
      swapDir(config.keysDir, freshKeys, path.join(oldDir, "keys"));
      keysSwapped = true;
    }

    // --- 7. Migrationen ---
    setRestorePhase("migrate", 80, "Migrationen anwenden");
    openDatabase(config.dbPath);

    setRestorePhase("reopen", 95, "Backend neu initialisieren");

    // --- 8. Wartungsmodus aus ---
    leaveMaintenance();
    finishRestoreProgress(true, "Wiederherstellung abgeschlossen");
    audit({
      userId: opts.triggeredBy ?? null,
      action: "restore.success",
      detail: {
        archivePath: path.basename(opts.archivePath),
        manifest: { app: parsed.manifest.appVersion, schema: parsed.manifest.schemaVersion },
      },
    });

    // tmp aufräumen — old behalten wir 24h (manueller Restore-Rollback im Notfall)
    setTimeout(() => safeRm(workDir), 24 * 60 * 60_000).unref?.();

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // ROLLBACK: swap rückgängig
    try {
      if (keysSwapped) rollbackSwap(config.keysDir, path.join(oldDir, "keys"));
      if (uploadsSwapped) rollbackSwap(config.uploadsDir, path.join(oldDir, "uploads"));
      if (dbSwapped) rollbackSwap(config.dbDir, path.join(oldDir, "db"));
      if (didDbClose) {
        try {
          openDatabase(config.dbPath);
        } catch (e) {
          audit({ action: "restore.reopen.fail", detail: String(e) });
        }
      }
      finishRestoreProgress(false, "Wiederherstellung fehlgeschlagen — Daten unverändert", msg);
      audit({ action: "restore.fail", detail: { error: msg } });
    } finally {
      leaveMaintenance();
    }

    safeRm(workDir);
    return { ok: false, error: msg };
  }
}
