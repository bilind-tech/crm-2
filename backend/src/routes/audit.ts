import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { getDatabase } from "../db/index.js";

interface AuditRow {
  id: number; user_id: string | null; action: string;
  detail: string | null; ip: string | null; at: string;
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  // MVP: jeder eingeloggte User sieht nur seine eigenen Audit-Einträge.
  // Volle Admin-Sicht kommt mit Rollen-Modul.
  app.get("/audit", { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 200);
    const where: string[] = ["user_id = ?"];
    const params: unknown[] = [req.user!.id];
    if (q.action) { where.push("action = ?"); params.push(q.action); }
    if (q.from)   { where.push("datetime(at) >= datetime(?)"); params.push(q.from); }
    if (q.to)     { where.push("datetime(at) <= datetime(?)"); params.push(q.to); }
    if (q.vor)    { where.push("datetime(at) <  datetime(?)"); params.push(q.vor); }
    const rows = getDatabase()
      .prepare(`SELECT id, user_id, action, detail, ip, at FROM audit_log
                WHERE ${where.join(" AND ")} ORDER BY at DESC LIMIT ?`)
      .all(...params, limit + 1) as AuditRow[];
    const more = rows.length > limit;
    const slice = more ? rows.slice(0, limit) : rows;
    return {
      items: slice.map((r) => ({
        id: r.id, userId: r.user_id, action: r.action,
        detail: r.detail ? safeParse(r.detail) : null,
        ip: r.ip, zeitpunkt: r.at,
      })),
      naechsterCursor: more ? slice[slice.length - 1].at : undefined,
    };
  });
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
