// Frontend-Scheduler: ruft im Mock-Modus alle 60s den Lauf-Check auf.
// Im Live-Modus (Pi) macht das ein Cron — dann nicht aufrufen (oder no-op).

import { api } from "@/lib/api/client";

let timerId: ReturnType<typeof setInterval> | null = null;
let started = false;

export interface SchedulerCheckResult {
  erzeugteLaeufe: number;
  neueDokumentBenachrichtigungen?: number;
}

export async function checkLaeufeJetzt(): Promise<SchedulerCheckResult> {
  try {
    const lauf = await api.post<{ erzeugteLaeufe: number }>("/dauerauftrag-laeufe/check");
    let neue = 0;
    try {
      const fristen = await api.post<{ neue: number }>("/dokumente/check-fristen");
      neue = fristen?.neue ?? 0;
    } catch {
      /* ignore */
    }
    return { erzeugteLaeufe: lauf.erzeugteLaeufe, neueDokumentBenachrichtigungen: neue };
  } catch {
    return { erzeugteLaeufe: 0 };
  }
}

/**
 * Startet den Frontend-Scheduler. Idempotent — mehrfacher Aufruf hat keinen Effekt.
 * `onResult` wird aufgerufen, wenn neue Läufe erzeugt wurden (für Toast/Invalidate).
 */
export function startScheduler(opts?: {
  intervalMs?: number;
  onResult?: (r: SchedulerCheckResult) => void;
}) {
  if (started) return;
  started = true;
  const interval = opts?.intervalMs ?? 60_000;

  // Erster Check beim Start (nach kleiner Verzögerung, damit App rendern darf)
  const run = async () => {
    const r = await checkLaeufeJetzt();
    if (r.erzeugteLaeufe > 0 || (r.neueDokumentBenachrichtigungen ?? 0) > 0) {
      opts?.onResult?.(r);
    }
  };
  setTimeout(run, 2_000);
  timerId = setInterval(run, interval);
}

export function stopScheduler() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  started = false;
}
