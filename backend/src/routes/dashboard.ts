// Dashboard-Endpoints: Kennzahlen, Umsatz, Warnungen.
// Umsatz nach Soll-Versteuerung: alle nicht-stornierten/nicht-entwurf Rechnungen
// zählen ab dem `rechnungsdatum`. Sobald eine Rechnung bezahlt markiert ist,
// bleibt sie im Umsatz — sie war es vorher als „versendet" auch schon.
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { getDatabase } from "../db/index.js";
import { rechnungBruttoCt, rechnungNettoCt, zahlungSummeCt } from "../belege/totals.js";

const UMSATZ_STATUS = ["versendet", "teilbezahlt", "bezahlt", "ueberfaellig"] as const;
const OFFEN_STATUS = ["versendet", "teilbezahlt", "ueberfaellig"] as const;

interface RechnungRow {
  id: string;
  rechnungsdatum: string;
}

function monatKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function letzte12MonateKeys(): string[] {
  const heute = new Date();
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(heute.getFullYear(), heute.getMonth() - i, 1);
    keys.push(monatKey(d));
  }
  return keys;
}

function jahrMonateKeys(jahr: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${jahr}-${String(i + 1).padStart(2, "0")}`);
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

    // ----- Kennzahlen -----
    scoped.get<{ Querystring: { jahr?: string; monat?: string } }>(
      "/dashboard/kennzahlen",
      async (req) => {
        const db = getDatabase();
        const jahr = req.query.jahr;
        const monat = req.query.monat;

        const aktiveKunden =
          (db.prepare(`SELECT COUNT(*) AS n FROM kunde WHERE archiviert = 0`).get() as { n: number })
            .n ?? 0;
        const aktiveObjekte =
          (db.prepare(`SELECT COUNT(*) AS n FROM objekt WHERE status = 'aktiv'`).get() as { n: number })
            .n ?? 0;
        const offeneAngebote =
          (db.prepare(`SELECT COUNT(*) AS n FROM angebot WHERE status = 'versendet'`).get() as { n: number })
            .n ?? 0;

        const whereParts: string[] = [
          `status IN (${OFFEN_STATUS.map(() => "?").join(",")})`,
        ];
        const params: unknown[] = [...OFFEN_STATUS];
        if (jahr && jahr !== "alle") {
          whereParts.push(`substr(rechnungsdatum,1,4) = ?`);
          params.push(jahr);
          if (monat && monat !== "alle") {
            whereParts.push(`substr(rechnungsdatum,6,2) = ?`);
            params.push(monat);
          }
        }
        const offeneRows = db
          .prepare(`SELECT id FROM rechnung WHERE ${whereParts.join(" AND ")}`)
          .all(...params) as { id: string }[];
        let ausstehendCt = 0;
        for (const r of offeneRows) {
          ausstehendCt += Math.max(0, rechnungBruttoCt(db, r.id) - zahlungSummeCt(db, r.id));
        }
        return {
          aktiveKunden,
          aktiveObjekte,
          offeneAngebote,
          offeneRechnungen: offeneRows.length,
          ausstehendEUR: ausstehendCt / 100,
        };
      },
    );

    // ----- Umsatz -----
    scoped.get<{ Querystring: { jahr?: string; monat?: string } }>(
      "/dashboard/umsatz",
      async (req) => {
        const db = getDatabase();
        const jahr = req.query.jahr;
        const monat = req.query.monat;

        const whereParts: string[] = [
          `status IN (${UMSATZ_STATUS.map(() => "?").join(",")})`,
        ];
        const params: unknown[] = [...UMSATZ_STATUS];
        let keys: string[];
        if (jahr && jahr !== "alle") {
          whereParts.push(`substr(rechnungsdatum,1,4) = ?`);
          params.push(jahr);
          if (monat && monat !== "alle") {
            whereParts.push(`substr(rechnungsdatum,6,2) = ?`);
            params.push(monat);
            keys = [`${jahr}-${monat}`];
          } else {
            keys = jahrMonateKeys(jahr);
          }
        } else {
          keys = letzte12MonateKeys();
          // Auf die letzten 12 Monate einschränken (inkl. aktuellem)
          whereParts.push(`substr(rechnungsdatum,1,7) >= ?`);
          params.push(keys[0]);
          whereParts.push(`substr(rechnungsdatum,1,7) <= ?`);
          params.push(keys[keys.length - 1]);
        }

        const rows = db
          .prepare(`SELECT id, rechnungsdatum FROM rechnung WHERE ${whereParts.join(" AND ")}`)
          .all(...params) as RechnungRow[];

        const buckets = new Map<string, { brutto: number; netto: number }>();
        for (const k of keys) buckets.set(k, { brutto: 0, netto: 0 });
        for (const r of rows) {
          const k = r.rechnungsdatum.slice(0, 7);
          const b = buckets.get(k);
          if (!b) continue;
          b.brutto += rechnungBruttoCt(db, r.id);
          b.netto += rechnungNettoCt(db, r.id);
        }
        return keys.map((k) => ({
          monat: k,
          brutto: (buckets.get(k)?.brutto ?? 0) / 100,
          netto: (buckets.get(k)?.netto ?? 0) / 100,
        }));
      },
    );

    // ----- Warnungen (MVP: leer) -----
    scoped.get("/dashboard/warnungen", async () => {
      return [];
    });
  });
}