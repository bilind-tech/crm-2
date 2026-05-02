import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { list, getById } from "../aktivitaet/repo.js";

export async function aktivitaetRoutes(app: FastifyInstance): Promise<void> {
  app.get("/aktivitaeten", { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return list({
      limit: q.limit ? Number(q.limit) : undefined,
      vor: q.vor,
      art: q.art,
      bezugArt: q.bezugArt,
      bezugId: q.bezugId,
    });
  });

  app.get("/aktivitaeten/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = getById(id);
    if (!a) { reply.status(404).send({ error: "not_found" }); return; }
    return a;
  });
}
