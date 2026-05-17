// REST-Endpunkte für Daueraufträge, Läufe, Sonderpositionen.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { audit } from "../auth/audit.js";
import { getKunde } from "../kunden/repo.js";
import {
  createDauerauftrag,
  createSonderposition,
  deleteDauerauftrag,
  deleteSonderposition,
  getDauerauftrag,
  listDauerauftraege,
  listLaeufe,
  listLaeufeFuer,
  listSonderpositionen,
  updateDauerauftrag,
} from "../dauerauftrag/repo.js";
import { fuehreSofortLaufAus } from "../dauerauftrag/generator.js";

const positionSchema = z.object({
  id: z.string().optional(),
  beschreibung: z.string().max(2000).optional(),
  menge: z.number().optional(),
  einheit: z.string().max(20).optional(),
  einzelpreisNetto: z.number().optional(),
  steuersatz: z.number().min(0).max(100).optional(),
  rabatt: z.number().min(0).max(100).optional(),
  modus: z.enum(["einzel", "pauschal", "stunden"]).optional(),
  pauschalpreisNetto: z.number().optional(),
  ausfuehrung: z.string().max(200).optional(),
});

const stichtagSchema = z.object({
  typ: z.enum(["monatstag", "monatsletzter", "quartalstag"]),
  wert: z.number().int().min(1).max(31).optional(),
});

const createSchema = z.object({
  kundeId: z.string().min(1),
  objektId: z.string().nullish(),
  ansprechpartnerId: z.string().nullish(),
  bezeichnung: z.string().max(500).optional(),
  frequenz: z.enum(["monatlich", "quartalsweise", "halbjaehrlich", "jaehrlich"]).optional(),
  stichtag: stichtagSchema.optional(),
  laufzeitVon: z.string().optional(),
  laufzeitBis: z.string().nullish(),
  positionen: z.array(positionSchema).max(500).optional(),
  rabattGesamt: z.number().min(0).max(100).optional(),
  steuersatz: z.number().min(0).max(100).optional(),
  betreffVorlage: z.string().max(500).optional(),
  textVorlage: z.string().max(10000).optional(),
  modus: z.enum(["entwurf", "vollautomatisch"]).optional(),
  emailEmpfaenger: z.array(z.string().email()).optional(),
  status: z.enum(["aktiv", "pausiert", "beendet"]).optional(),
  pausiertBis: z.string().nullish(),
  notizen: z.string().max(10000).nullish(),
});

const patchSchema = createSchema.partial().extend({ kundeId: z.string().min(1).optional() });

export async function dauerauftragRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

    scoped.get("/dauerauftraege", async () => listDauerauftraege());

    scoped.get<{ Params: { id: string } }>("/dauerauftraege/:id", async (req, reply) => {
      const da = getDauerauftrag(req.params.id);
      if (!da) { reply.status(404); return { error: "not-found" }; }
      return {
        ...da,
        laeufe: listLaeufeFuer(da.id),
        sonderpositionen: listSonderpositionen(da.id),
      };
    });

    scoped.post("/dauerauftraege", async (req, reply) => {
      const p = createSchema.safeParse(req.body);
      if (!p.success) { reply.status(422); return { error: "validation", detail: p.error.flatten() }; }
      if (!getKunde(p.data.kundeId)) { reply.status(404); return { error: "kunde-not-found" }; }
      const da = createDauerauftrag(p.data);
      audit({ userId: req.user?.id, action: "dauerauftrag.create", detail: { id: da.id, nummer: da.nummer }, ip: req.ip });
      return da;
    });

    scoped.patch<{ Params: { id: string } }>("/dauerauftraege/:id", async (req, reply) => {
      const p = patchSchema.safeParse(req.body ?? {});
      if (!p.success) { reply.status(422); return { error: "validation", detail: p.error.flatten() }; }
      const da = updateDauerauftrag(req.params.id, p.data as Record<string, unknown>);
      if (!da) { reply.status(404); return { error: "not-found" }; }
      audit({ userId: req.user?.id, action: "dauerauftrag.update", detail: { id: da.id }, ip: req.ip });
      return da;
    });

    scoped.delete<{ Params: { id: string } }>("/dauerauftraege/:id", async (req, reply) => {
      const ok = deleteDauerauftrag(req.params.id);
      if (!ok) { reply.status(404); return { error: "not-found" }; }
      audit({ userId: req.user?.id, action: "dauerauftrag.delete", detail: { id: req.params.id }, ip: req.ip });
      reply.status(204);
    });

    const sofortSchema = z.object({ periode: z.string().min(4).max(20).optional() });
    scoped.post<{ Params: { id: string } }>("/dauerauftraege/:id/sofort-lauf", async (req, reply) => {
      const p = sofortSchema.safeParse(req.body ?? {});
      if (!p.success) { reply.status(422); return { error: "validation", detail: p.error.flatten() }; }
      const res = fuehreSofortLaufAus(req.params.id, p.data.periode);
      if (!res) { reply.status(404); return { error: "not-found" }; }
      audit({ userId: req.user?.id, action: "dauerauftrag.sofort-lauf", detail: { id: req.params.id, periode: res.lauf.periode, rechnungId: res.rechnungId }, ip: req.ip });
      return res.lauf;
    });

    const pauseSchema = z.object({ bis: z.string().nullable() });
    scoped.post<{ Params: { id: string } }>("/dauerauftraege/:id/pausieren", async (req, reply) => {
      const p = pauseSchema.safeParse(req.body ?? {});
      if (!p.success) { reply.status(422); return { error: "validation", detail: p.error.flatten() }; }
      const da = updateDauerauftrag(req.params.id, { status: "pausiert", pausiertBis: p.data.bis });
      if (!da) { reply.status(404); return { error: "not-found" }; }
      audit({ userId: req.user?.id, action: "dauerauftrag.pausieren", detail: { id: da.id, bis: p.data.bis }, ip: req.ip });
      return da;
    });

    const endeSchema = z.object({ zum: z.string().optional() });
    scoped.post<{ Params: { id: string } }>("/dauerauftraege/:id/beenden", async (req, reply) => {
      const p = endeSchema.safeParse(req.body ?? {});
      if (!p.success) { reply.status(422); return { error: "validation", detail: p.error.flatten() }; }
      const da = updateDauerauftrag(req.params.id, {
        status: "beendet",
        laufzeitBis: p.data.zum ?? new Date().toISOString().slice(0, 10),
      });
      if (!da) { reply.status(404); return { error: "not-found" }; }
      audit({ userId: req.user?.id, action: "dauerauftrag.beenden", detail: { id: da.id }, ip: req.ip });
      return da;
    });

    scoped.get("/dauerauftrag-laeufe", async (req) => {
      const q = req.query as Record<string, string | undefined>;
      return listLaeufe(q.status);
    });

    const sopoSchema = z.object({
      dauerauftragId: z.string().min(1),
      fuerPeriode: z.string().min(4).max(20),
      position: positionSchema,
    });
    scoped.post("/dauerauftrag-sonderpositionen", async (req, reply) => {
      const p = sopoSchema.safeParse(req.body);
      if (!p.success) { reply.status(422); return { error: "validation", detail: p.error.flatten() }; }
      if (!getDauerauftrag(p.data.dauerauftragId)) { reply.status(404); return { error: "dauerauftrag-not-found" }; }
      const sp = createSonderposition(p.data);
      audit({ userId: req.user?.id, action: "dauerauftrag.sonderposition.create", detail: { id: sp.id }, ip: req.ip });
      return sp;
    });

    scoped.delete<{ Params: { id: string } }>("/dauerauftrag-sonderpositionen/:id", async (req, reply) => {
      const ok = deleteSonderposition(req.params.id);
      if (!ok) { reply.status(404); return { error: "not-found" }; }
      audit({ userId: req.user?.id, action: "dauerauftrag.sonderposition.delete", detail: { id: req.params.id }, ip: req.ip });
      reply.status(204);
    });
  });
}
