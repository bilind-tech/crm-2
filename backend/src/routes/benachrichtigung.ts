import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import {
  listBenachrichtigungen, ungeleseneZahl, gesamtZahl,
  markGelesen, markAlleGelesen, wegwischen, getById,
} from "../benachrichtigung/repo.js";

export async function benachrichtigungRoutes(app: FastifyInstance): Promise<void> {
  app.get("/benachrichtigungen", { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return {
      items: listBenachrichtigungen({
        nurUngelesen: q.nurUngelesen === "true",
        limit: q.limit ? Number(q.limit) : undefined,
      }),
    };
  });

  app.get("/benachrichtigungen/anzahl", { preHandler: requireAuth }, async () => ({
    ungelesen: ungeleseneZahl(),
    gesamt: gesamtZahl(),
  }));

  const markOne = async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const ok = markGelesen(id);
    if (!ok) { reply.status(404).send({ error: "not_found" }); return; }
    return getById(id);
  };
  app.post("/benachrichtigungen/:id/lesen", { preHandler: requireAuth }, markOne);
  app.patch("/benachrichtigungen/:id/gelesen", { preHandler: requireAuth }, markOne);

  const markAll = async () => ({ geaendert: markAlleGelesen() });
  app.post("/benachrichtigungen/lesen-alle", {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, markAll);
  app.post("/benachrichtigungen/alle-gelesen", {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, markAll);

  app.post("/benachrichtigungen/:id/wegwischen", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = wegwischen(id);
    if (!ok) { reply.status(404).send({ error: "not_found" }); return; }
    return { ok: true };
  });
}
