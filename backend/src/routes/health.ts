import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getDatabase, getSchemaVersion, isWalActive } from "../db/index.js";
import { existsSync, statfsSync } from "node:fs";
import { requireAuth } from "../auth/middleware.js";
import { listVisible, listInProgress } from "../backup/repo.js";
import { getMaintenanceInfo } from "../backup/maintenance.js";

const startTime = Date.now();

function diskFree(dir: string): { freeBytes: number | null; totalBytes: number | null } {
  try {
    const s = statfsSync(dir);
    return {
      freeBytes: Number(s.bavail) * Number(s.bsize),
      totalBytes: Number(s.blocks) * Number(s.bsize),
    };
  } catch {
    return { freeBytes: null, totalBytes: null };
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    const db = getDatabase();
    let dbOk = false;
    try {
      const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
      dbOk = row?.ok === 1;
    } catch {
      dbOk = false;
    }
    const maint = getMaintenanceInfo();

    return {
      status: dbOk ? "ok" : "degraded",
      version: config.version,
      schemaVersion: getSchemaVersion(),
      db: { ok: dbOk, wal: isWalActive(db), path: config.dbPath },
      masterKey: { present: existsSync(config.keyPath) },
      maintenance: maint.active,
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
    };
  });

  app.get("/version", async () => ({
    version: config.version,
    schemaVersion: getSchemaVersion(),
  }));

  // Detail nur eingeloggt
  app.get("/health/detail", { preHandler: requireAuth }, async () => {
    const db = getDatabase();
    const userCnt = (db.prepare(`SELECT COUNT(*) AS c FROM app_user`).get() as { c: number }).c;
    const sessCnt = (db.prepare(`SELECT COUNT(*) AS c FROM auth_session`).get() as { c: number }).c;
    const auditCnt = (db.prepare(`SELECT COUNT(*) AS c FROM audit_log`).get() as { c: number }).c;
    const data = diskFree(config.dataDir);
    const backups = diskFree(config.backupsDir);
    const visible = listVisible();
    const inProg = listInProgress();
    const last = visible[0] ?? null;
    return {
      version: config.version,
      schemaVersion: getSchemaVersion(),
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
      counts: { user: userCnt, session: sessCnt, audit: auditCnt, backup: visible.length },
      disk: {
        dataDir: config.dataDir,
        freeBytes: data.freeBytes,
        totalBytes: data.totalBytes,
        backups: backups,
      },
      backup: {
        lastAt: last?.completedAt ?? null,
        lastOk: last ? last.status === "success" : null,
        inProgress: inProg.length,
      },
      maintenance: getMaintenanceInfo(),
      memory: process.memoryUsage(),
    };
  });
}

