// In-Memory-Live-Status für laufende Backups & Restores.
// Wird vom Frontend per Polling gelesen (später ggf. SSE in Step 8).
import type { BackupPhase, BackupProgress, RestorePhase, RestoreProgress } from "./types.js";

const backups = new Map<string, BackupProgress>();
let restore: RestoreProgress | null = null;

export function startBackupProgress(id: string): void {
  backups.set(id, { id, phase: "queued", percent: 0, startedAt: new Date().toISOString() });
}

export function setBackupPhase(id: string, phase: BackupPhase, percent: number, message?: string): void {
  const p = backups.get(id);
  if (!p) return;
  p.phase = phase;
  p.percent = Math.max(p.percent, percent);
  p.message = message;
}

export function finishBackupProgress(id: string, ok: boolean, message?: string): void {
  const p = backups.get(id);
  if (!p) return;
  p.phase = ok ? "done" : "failed";
  p.percent = 100;
  p.message = message;
  // Eintrag noch 30 s sichtbar lassen, damit das Frontend den Endzustand sieht
  setTimeout(() => backups.delete(id), 30_000).unref?.();
}

export function listBackupProgress(): BackupProgress[] {
  return Array.from(backups.values()).filter((p) => p.phase !== "done" && p.phase !== "failed").concat(
    Array.from(backups.values()).filter((p) => p.phase === "done" || p.phase === "failed"),
  );
}

export function getBackupProgress(id: string): BackupProgress | undefined {
  return backups.get(id);
}

export function startRestoreProgress(id: string): void {
  restore = { id, phase: "queued", percent: 0, startedAt: new Date().toISOString() };
}

export function setRestorePhase(phase: RestorePhase, percent: number, message?: string): void {
  if (!restore) return;
  restore.phase = phase;
  restore.percent = Math.max(restore.percent, percent);
  restore.message = message;
}

export function finishRestoreProgress(ok: boolean, message?: string, error?: string): void {
  if (!restore) return;
  restore.phase = ok ? "done" : "failed";
  restore.percent = 100;
  restore.message = message;
  restore.error = error;
  restore.finishedAt = new Date().toISOString();
}

export function getRestoreProgress(): RestoreProgress | null {
  return restore;
}
