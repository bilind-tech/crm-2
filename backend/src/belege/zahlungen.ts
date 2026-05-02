// Zahlungen anlegen/löschen + Status nachziehen.
import crypto from "node:crypto";
import { getDatabase } from "../db/index.js";
import { euroToCt, zahlungRowToApi, type ApiZahlung, type DbZahlung } from "./mappers.js";
import { recomputeRechnungStatus } from "./status.js";
import { emitBelegMutated } from "./events.js";
import { emit } from "../events/bus.js";

export interface ZahlungInput {
  datum?: string;
  betrag: number;
  methode?: string;
  referenz?: string;
  notiz?: string;
}

const ALLOWED_METHODEN = ["ueberweisung", "bar", "karte", "paypal", "sepa", "sonstiges"];

export function addZahlung(rechnungId: string, data: ZahlungInput): ApiZahlung | null {
  const db = getDatabase();
  const exists = db.prepare(`SELECT 1 FROM rechnung WHERE id = ?`).get(rechnungId);
  if (!exists) return null;
  const id = crypto.randomUUID();
  const datum = data.datum ?? new Date().toISOString().slice(0, 10);
  const methode = data.methode && ALLOWED_METHODEN.includes(data.methode) ? data.methode : "ueberweisung";
  const betragCt = euroToCt(data.betrag);
  if (betragCt <= 0) throw new Error("betrag-ungueltig");

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO zahlung (id, rechnung_id, datum, betrag_ct, methode, referenz, notiz)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, rechnungId, datum, betragCt, methode, data.referenz ?? null, data.notiz ?? null);
  });
  tx();
  recomputeRechnungStatus(rechnungId);
  emitBelegMutated("rechnung", rechnungId);
  const statusRow = db.prepare(`SELECT status FROM rechnung WHERE id = ?`).get(rechnungId) as { status: string } | undefined;
  emit("zahlung:erfasst", {
    rechnungId,
    betrag: data.betrag,
    statusNachher: statusRow?.status ?? "unbekannt",
  });

  const row = db
    .prepare(
      `SELECT id, rechnung_id, datum, betrag_ct, methode, referenz, notiz, erstellt_am
         FROM zahlung WHERE id = ?`,
    )
    .get(id) as DbZahlung;
  return zahlungRowToApi(row);
}

export function deleteZahlung(rechnungId: string, zahlungId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare(`DELETE FROM zahlung WHERE id = ? AND rechnung_id = ?`)
    .run(zahlungId, rechnungId);
  if (result.changes === 0) return false;
  recomputeRechnungStatus(rechnungId);
  emitBelegMutated("rechnung", rechnungId);
  return true;
}
