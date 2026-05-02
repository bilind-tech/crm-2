// Tägliche Steuer-Frist-Prüfung — Benachrichtigungen für offene/fällige
// **manuelle** Steuer-Posten. Auto-Posten (USt/KSt/Soli/GewSt) leben im
// Frontend-Berechnungs-Layer und werden dort gewarnt.
import { getDatabase } from "../db/index.js";
import { listManuellePosten, listBezahlt } from "./repo.js";
import { record } from "../aktivitaet/repo.js";

export type FristStatus = "ok" | "bald" | "heute" | "ueberfaellig" | "erledigt";

const TAGE_BALD = 7;

function tageDifferenz(a: string, b: string): number {
  const dA = new Date(a + "T00:00:00").getTime();
  const dB = new Date(b + "T00:00:00").getTime();
  return Math.round((dA - dB) / 86_400_000);
}

export function fristStatusFor(faelligAm: string, heute: string): FristStatus {
  const d = tageDifferenz(faelligAm, heute);
  if (d < 0) return "ueberfaellig";
  if (d === 0) return "heute";
  if (d <= TAGE_BALD) return "bald";
  return "ok";
}

const STATUS_LABEL: Record<
  "ueberfaellig" | "heute" | "bald",
  { titel: (t: string) => string; prio: "warnung" | "fehler" }
> = {
  ueberfaellig: { titel: (t) => `Steuer überfällig: ${t}`, prio: "fehler" },
  heute: { titel: (t) => `Steuer heute fällig: ${t}`, prio: "warnung" },
  bald: { titel: (t) => `Steuer bald fällig: ${t}`, prio: "warnung" },
};

function alreadyLogged(postenId: string, tag: string, status: string): boolean {
  const db = getDatabase();
  const r = db
    .prepare(
      "SELECT 1 FROM steuer_frist_benachrichtigung_log WHERE posten_id = ? AND tag = ? AND status = ? LIMIT 1",
    )
    .get(postenId, tag, status);
  return !!r;
}

function logBenachrichtigung(postenId: string, tag: string, status: string): void {
  const db = getDatabase();
  db.prepare(
    "INSERT OR IGNORE INTO steuer_frist_benachrichtigung_log (posten_id, tag, status) VALUES (?, ?, ?)",
  ).run(postenId, tag, status);
}

export interface SteuerFristResult {
  geprueft: number;
  benachrichtigt: number;
  uebersprungen: number;
}

export function runSteuerFristCheck(now = new Date()): SteuerFristResult {
  const heute = now.toISOString().slice(0, 10);
  const tag = heute;
  const posten = listManuellePosten();
  const bezahlt = listBezahlt();

  let benachrichtigt = 0;
  let uebersprungen = 0;
  for (const p of posten) {
    if (bezahlt[p.id]) {
      uebersprungen++;
      continue;
    }
    const status = fristStatusFor(p.faelligAm, heute);
    if (status === "ok" || status === "erledigt") {
      uebersprungen++;
      continue;
    }
    if (alreadyLogged(p.id, tag, status)) {
      uebersprungen++;
      continue;
    }
    const tpl = STATUS_LABEL[status];
    record({
      art: "steuer_frist",
      bezugArt: "steuer_posten",
      bezugId: p.id,
      titel: tpl.titel(p.titel),
      beschreibung: `Fällig am ${p.faelligAm} — geschätzt ${p.geschaetzterBetrag.toFixed(2)} €`,
      notify: {
        prioritaet: tpl.prio,
        titel: tpl.titel(p.titel),
        beschreibung: `Fällig am ${p.faelligAm}`,
        aktionLabel: "Öffnen",
        aktionRoute: "/steuern",
      },
    });
    logBenachrichtigung(p.id, tag, status);
    benachrichtigt++;
  }
  return { geprueft: posten.length, benachrichtigt, uebersprungen };
}
