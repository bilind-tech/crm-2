// Rotation:
//   - Daily-FIFO   (default 7)
//   - Weekly-FIFO  (default 4) — am Sonntag wird das jüngste Daily promoted
//   - Monthly-FIFO (default 12) — am 1. des Monats wird das jüngste Daily promoted
//   - Safety: nicht automatisch löschen
//
// Quelle der Wahrheit: backup_history (DB) UND die echten Dateien auf der Platte.
// Wenn eine Datei fehlt aber DB-Eintrag existiert → DB-Eintrag bleibt; das Frontend
// blendet ihn dann nicht ein, da Download fehlschlägt. Hier räumen wir DB UND Datei.

import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { audit } from "../auth/audit.js";
import { getSetting } from "../settings/store.js";
import { BackupPlanSchema } from "../settings/schemas.js";
import { categoryDir } from "./paths.js";
import { deleteRow, listByCategory, newBackupId } from "./repo.js";
import { getDatabase, getSchemaVersion } from "../db/index.js";
import type { BackupCategory } from "./types.js";

function plan(): {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  weeklyEnabled: boolean;
  weeklyDay: number;
  monthlyEnabled: boolean;
} {
  const stored = getSetting("backup");
  return BackupPlanSchema.parse(stored ?? {});
}

function fileForRow(cat: BackupCategory, filename: string): string {
  return path.join(categoryDir(cat), filename);
}

function deleteRowAndFile(cat: BackupCategory, id: string, filename: string): void {
  try {
    const f = fileForRow(cat, filename);
    if (existsSync(f)) unlinkSync(f);
  } catch {
    /* best effort */
  }
  deleteRow(id);
}

function trimCategory(cat: BackupCategory, keep: number): number {
  const rows = listByCategory(cat);
  if (rows.length <= keep) return 0;
  const remove = rows.slice(keep);
  for (const r of remove) deleteRowAndFile(cat, r.id, r.filename);
  return remove.length;
}

function promoteFromDaily(toCat: BackupCategory): boolean {
  const dailies = listByCategory("daily");
  if (dailies.length === 0) return false;
  const newest = dailies[0];

  // Wenn heute bereits ein Eintrag dieser Kategorie existiert → skip
  const today = new Date().toISOString().slice(0, 10);
  const existing = listByCategory(toCat).find((r) => (r.completedAt ?? r.startedAt).slice(0, 10) === today);
  if (existing) return false;

  const sourcePath = fileForRow("daily", newest.filename);
  if (!existsSync(sourcePath)) return false;

  const id = newBackupId();
  const cleanFile = newest.filename.replace(/^backup-daily-/, `backup-${toCat}-`);
  const destPath = path.join(categoryDir(toCat), cleanFile);
  copyFileSync(sourcePath, destPath);

  // DB-Eintrag schreiben (success direkt, weil Datei sofort liegt)
  getDatabase()
    .prepare(
      `INSERT INTO backup_history (id, filename, category, trigger, size_bytes, status, started_at, completed_at, sha256, schema_version, app_version)
       VALUES (?, ?, ?, ?, ?, 'success', datetime('now'), datetime('now'), ?, ?, ?)`,
    )
    .run(
      id,
      cleanFile,
      toCat,
      "auto",
      newest.sizeBytes,
      newest.sha256 ?? "",
      newest.schemaVersion ?? getSchemaVersion(),
      newest.appVersion ?? config.version,
    );

  audit({ action: "backup.promote", detail: { from: "daily", to: toCat, id } });
  return true;
}

/** Wird nach jedem erfolgreichen Daily-Backup gerufen. */
export function rotate(): { promoted: string[]; trimmed: Record<BackupCategory, number> } {
  const cfg = plan();
  const now = new Date();
  const promoted: string[] = [];

  // Promotion: Sonntag (0) → weekly, 1. d. Monats → monthly
  if (cfg.weeklyEnabled && now.getDay() === cfg.weeklyDay && promoteFromDaily("weekly")) {
    promoted.push("weekly");
  }
  if (cfg.monthlyEnabled && now.getDate() === 1 && promoteFromDaily("monthly")) {
    promoted.push("monthly");
  }

  // Trimmen
  const trimmed: Record<BackupCategory, number> = {
    daily: trimCategory("daily", cfg.keepDaily),
    weekly: trimCategory("weekly", cfg.keepWeekly),
    monthly: trimCategory("monthly", cfg.keepMonthly),
    manual: 0,
    "pre-restore": 0,
    "pre-update": 0,
  };

  return { promoted, trimmed };
}

/** Reine Aufräumfunktion: löscht DB-Geister deren Datei nicht mehr existiert. */
export function reconcileDiskState(): number {
  let removed = 0;
  for (const cat of ["daily", "weekly", "monthly", "manual", "pre-restore", "pre-update"] as BackupCategory[]) {
    const rows = listByCategory(cat);
    for (const r of rows) {
      if (!existsSync(fileForRow(cat, r.filename))) {
        deleteRow(r.id);
        removed++;
      }
    }
  }
  return removed;
}
