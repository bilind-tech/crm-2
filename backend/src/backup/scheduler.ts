// node-cron Scheduler. Liest Plan aus Settings beim Boot UND bei jedem PATCH neu.
import cron, { type ScheduledTask } from "node-cron";
import { audit } from "../auth/audit.js";
import { getSetting } from "../settings/store.js";
import { BackupPlanSchema } from "../settings/schemas.js";
import { createBackup } from "./create.js";

let task: ScheduledTask | null = null;
let currentExpr = "";

function planExpr(): { enabled: boolean; expr: string } {
  const cfg = BackupPlanSchema.parse(getSetting("backup") ?? {});
  // Täglich zur konfigurierten Uhrzeit
  const expr = `0 ${cfg.dailyAtHour} * * *`;
  return { enabled: cfg.dailyEnabled, expr };
}

export function startScheduler(): void {
  applyScheduler();
}

export function applyScheduler(): void {
  const { enabled, expr } = planExpr();

  if (task && expr === currentExpr && enabled) return;

  if (task) {
    task.stop();
    task = null;
  }
  currentExpr = expr;

  if (!enabled) {
    audit({ action: "backup.scheduler.disabled" });
    return;
  }
  if (!cron.validate(expr)) {
    audit({ action: "backup.scheduler.invalid", detail: { expr } });
    return;
  }

  task = cron.schedule(
    expr,
    () => {
      void createBackup({ category: "daily", trigger: "auto" }).catch((e) => {
        audit({ action: "backup.scheduled.fail", detail: String(e) });
      });
    },
    { timezone: process.env.TZ || "Europe/Berlin" },
  );

  audit({ action: "backup.scheduler.armed", detail: { expr } });
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
