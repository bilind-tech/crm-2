// REST-Routen für das Steuer-Modul (GmbH).
// Pfade:
//   GET    /steuern/einstellungen
//   PATCH  /steuern/einstellungen
//   POST   /steuern/einstellungen/reset
//   GET    /steuern/manuelle-posten
//   POST   /steuern/manuelle-posten
//   PATCH  /steuern/manuelle-posten/:id
//   DELETE /steuern/manuelle-posten/:id
//   GET    /steuern/bezahlt
//   PUT    /steuern/bezahlt/:postenId
//   DELETE /steuern/bezahlt/:postenId
import type { FastifyInstance } from "fastify";
import { requireOwner } from "../auth/middleware.js";
import { audit } from "../auth/audit.js";
import { emit } from "../events/bus.js";
import {
  addManuellerPosten,
  deleteBezahltByPrefix,
  getEinstellungen,
  listBezahlt,
  listManuellePosten,
  removeBezahlt,
  removeManuellerPosten,
  resetEinstellungen,
  setBezahlt,
  updateEinstellungen,
  updateManuellerPosten,
} from "../steuern/repo.js";
import {
  BezahltInputSchema,
  EinstellungenPatchSchema,
  ManuellerInputSchema,
  ManuellerPatchSchema,
} from "../steuern/validation.js";

export async function steuernRoutes(app: FastifyInstance): Promise<void> {
  // -------- Einstellungen --------
  app.get("/steuern/einstellungen", { preHandler: requireOwner }, async () => {
    return getEinstellungen();
  });

  app.patch("/steuern/einstellungen", { preHandler: requireOwner }, async (req, reply) => {
    const parsed = EinstellungenPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation", issues: parsed.error.issues });
    }
    const before = getEinstellungen();
    const next = updateEinstellungen(parsed.data);

    // Side-effect: USt-Rhythmus geändert → Bezahlt-Markierungen für USt-Auto-Posten
    // dieses und nächsten Jahres löschen, weil sich die deterministischen IDs ändern.
    let geloescht = 0;
    if (parsed.data.ustRhythmus && parsed.data.ustRhythmus !== before.ustRhythmus) {
      geloescht = deleteBezahltByPrefix("ust-");
    }

    audit({
      userId: req.user?.id ?? null,
      action: "steuer.einstellungen.update",
      detail: { patch: parsed.data, ustBezahltGeloescht: geloescht },
    });
    emit("einstellung:geaendert", { key: "steuern", userId: req.user?.id ?? null });
    return { ...next, ustBezahltGeloescht: geloescht };
  });

  app.post("/steuern/einstellungen/reset", { preHandler: requireOwner }, async (req) => {
    const next = resetEinstellungen();
    audit({
      userId: req.user?.id ?? null,
      action: "steuer.einstellungen.reset",
      detail: {},
    });
    emit("einstellung:geaendert", { key: "steuern", userId: req.user?.id ?? null });
    return next;
  });

  // -------- Manuelle Posten --------
  app.get("/steuern/manuelle-posten", { preHandler: requireOwner }, async () => {
    return listManuellePosten();
  });

  app.post("/steuern/manuelle-posten", { preHandler: requireOwner }, async (req, reply) => {
    const parsed = ManuellerInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation", issues: parsed.error.issues });
    }
    const created = addManuellerPosten(parsed.data);
    emit("einstellung:geaendert", { key: "steuern.manuell", userId: req.user?.id ?? null });
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    "/steuern/manuelle-posten/:id",
    { preHandler: requireOwner },
    async (req, reply) => {
      const parsed = ManuellerPatchSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation", issues: parsed.error.issues });
      }
      const next = updateManuellerPosten(req.params.id, parsed.data);
      if (!next) return reply.code(404).send({ error: "not-found" });
      emit("einstellung:geaendert", { key: "steuern.manuell", userId: req.user?.id ?? null });
      return next;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/steuern/manuelle-posten/:id",
    { preHandler: requireOwner },
    async (req, reply) => {
      const ok = removeManuellerPosten(req.params.id);
      if (!ok) return reply.code(404).send({ error: "not-found" });
      emit("einstellung:geaendert", { key: "steuern.manuell", userId: req.user?.id ?? null });
      return reply.code(204).send();
    },
  );

  // -------- Bezahlt-Markierungen --------
  app.get("/steuern/bezahlt", { preHandler: requireOwner }, async () => {
    return listBezahlt();
  });

  app.put<{ Params: { postenId: string } }>(
    "/steuern/bezahlt/:postenId",
    { preHandler: requireOwner },
    async (req, reply) => {
      const parsed = BezahltInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation", issues: parsed.error.issues });
      }
      const created = setBezahlt(req.params.postenId, parsed.data);
      emit("einstellung:geaendert", { key: "steuern.bezahlt", userId: req.user?.id ?? null });
      return created;
    },
  );

  app.delete<{ Params: { postenId: string } }>(
    "/steuern/bezahlt/:postenId",
    { preHandler: requireOwner },
    async (req, reply) => {
      const ok = removeBezahlt(req.params.postenId);
      if (!ok) return reply.code(404).send({ error: "not-found" });
      emit("einstellung:geaendert", { key: "steuern.bezahlt", userId: req.user?.id ?? null });
      return reply.code(204).send();
    },
  );
}
