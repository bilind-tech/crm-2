// Pfad-Helfer + Dateinamen-Builder für Backups.
import path from "node:path";
import { config } from "../config.js";
import type { BackupCategory } from "./types.js";

export function categoryDir(cat: BackupCategory): string {
  switch (cat) {
    case "daily":
      return config.backupsDailyDir;
    case "weekly":
      return config.backupsWeeklyDir;
    case "monthly":
      return config.backupsMonthlyDir;
    case "manual":
    case "pre-restore":
    case "pre-update":
      return config.backupsSafetyDir;
  }
}

/** ISO-ähnlicher, dateisystem-sicherer Zeitstempel: 2026-05-02T030000Z */
export function fsTimestamp(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "").replace("Z", "Z");
}

export function buildFilename(cat: BackupCategory, id: string, d = new Date()): string {
  return `backup-${cat}-${fsTimestamp(d)}-${id.slice(0, 8)}.tar.gz`;
}

export function targetPath(cat: BackupCategory, filename: string): string {
  return path.join(categoryDir(cat), filename);
}

export function tmpDir(id: string): string {
  return path.join(config.backupsTmpDir, id);
}

export function tmpArchivePath(id: string): string {
  return path.join(config.backupsTmpDir, `${id}.tar.gz`);
}
