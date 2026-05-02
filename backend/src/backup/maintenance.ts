// Wartungsmodus: blockiert während eines Restores ALLE Routen außer einer
// kleinen Whitelist. Status auch in einer Datei abgelegt, damit ein
// abgebrochener Restore beim Restart erkennbar bleibt.
import type { FastifyReply, FastifyRequest } from "fastify";
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { config } from "../config.js";

let active = false;
let reason = "";
let startedAt: string | null = null;

const ALLOWED_PATHS = new Set([
  "/health",
  "/health/detail",
  "/version",
  "/backup/restore-status",
]);

export function isMaintenance(): boolean {
  return active;
}

export function getMaintenanceInfo(): { active: boolean; reason: string; startedAt: string | null } {
  return { active, reason, startedAt };
}

export function enterMaintenance(why: string): void {
  active = true;
  reason = why;
  startedAt = new Date().toISOString();
  try {
    writeFileSync(
      config.maintenanceFlagPath,
      JSON.stringify({ reason: why, startedAt }),
      { mode: 0o600 },
    );
  } catch {
    /* best effort */
  }
}

export function leaveMaintenance(): void {
  active = false;
  reason = "";
  startedAt = null;
  try {
    if (existsSync(config.maintenanceFlagPath)) unlinkSync(config.maintenanceFlagPath);
  } catch {
    /* best effort */
  }
}

/** Beim Boot prüfen, ob ein Restore mittendrin abgebrochen wurde. Wenn ja,
 *  bleibt der Wartungsmodus erhalten — Operator muss explizit aufräumen. */
export function loadMaintenanceFlagFromDisk(): void {
  try {
    if (existsSync(config.maintenanceFlagPath)) {
      const raw = readFileSync(config.maintenanceFlagPath, "utf8");
      const parsed = JSON.parse(raw) as { reason?: string; startedAt?: string };
      active = true;
      reason = parsed.reason ?? "abgebrochener Restore beim letzten Start";
      startedAt = parsed.startedAt ?? new Date().toISOString();
    }
  } catch {
    /* ignore */
  }
}

export async function maintenanceGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!active) return;
  if (ALLOWED_PATHS.has(req.url.split("?")[0])) return;
  reply.header("Retry-After", "10");
  reply.header("X-Maintenance", "1");
  reply.status(503).send({
    error: "maintenance",
    reason,
    startedAt,
  });
}
