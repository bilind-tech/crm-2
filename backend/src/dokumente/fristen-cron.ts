// Tägliche Frist-Prüfung — erzeugt Benachrichtigungen für offene/fällige Dokumente.
// Idempotent pro Dokument+Tag+Status (siehe dokumente_frist_benachrichtigung_log).
import { listDokumente, fristAlreadyLogged, logFristBenachrichtigung } from "./repo.js";
import { fristStatus, isNotifyStatus } from "./frist.js";
import { record } from "../aktivitaet/repo.js";
import { runSteuerFristCheck } from "../steuern/fristen.js";

export interface FristCheckResult {
  geprueft: number;
  benachrichtigt: number;
  uebersprungen: number;
}

const STATUS_LABEL: Record<string, { titel: (t: string) => string; prio: "warnung" | "fehler" }> = {
  ueberfaellig: { titel: (t) => `Überfällig: ${t}`, prio: "fehler" },
  heute: { titel: (t) => `Heute fällig: ${t}`, prio: "warnung" },
  bald: { titel: (t) => `Bald fällig: ${t}`, prio: "warnung" },
};

export function runFristCheck(now = new Date()): FristCheckResult {
  const dokumente = listDokumente({ offen: true });
  const tag = now.toISOString().slice(0, 10);
  let benachrichtigt = 0;
  let uebersprungen = 0;
  for (const d of dokumente) {
    const status = fristStatus(d, now);
    if (!isNotifyStatus(status)) { uebersprungen++; continue; }
    if (fristAlreadyLogged(d.id, tag, status)) { uebersprungen++; continue; }
    const tpl = STATUS_LABEL[status];
    record({
      art: "dokument_frist",
      bezugArt: "dokument",
      bezugId: d.id,
      titel: tpl.titel(d.titel),
      beschreibung: d.faelligAm ? `Fällig am ${d.faelligAm}` : "",
      notify: {
        prioritaet: tpl.prio,
        titel: tpl.titel(d.titel),
        beschreibung: d.faelligAm ? `Fällig am ${d.faelligAm}` : "",
        aktionLabel: "Öffnen",
        aktionRoute: "/dokumente",
      },
    });
    logFristBenachrichtigung(d.id, tag, status);
    benachrichtigt++;
  }
  // Zusätzlich: manuelle Steuer-Posten prüfen.
  try {
    runSteuerFristCheck(now);
  } catch {
    /* swallow */
  }
  return { geprueft: dokumente.length, benachrichtigt, uebersprungen };
}

let timer: NodeJS.Timeout | null = null;

/** Startet einen leichtgewichtigen Scheduler: alle 60 min nachschauen ob 07:00 Pi-Zeit überschritten wurde. */
export function startFristenScheduler(): void {
  if (timer) return;
  let lastRunDay = "";
  const tick = (): void => {
    try {
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      // Lauf, wenn lokale Stunde >= 7 und heute noch nicht gelaufen
      if (now.getHours() >= 7 && day !== lastRunDay) {
        runFristCheck(now);
        lastRunDay = day;
      }
    } catch {
      /* ignore */
    }
  };
  timer = setInterval(tick, 30 * 60_000);
  timer.unref?.();
  // Beim Start einmal direkt nach hinten verzögert prüfen
  setTimeout(tick, 5_000).unref?.();
}

export function stopFristenScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
