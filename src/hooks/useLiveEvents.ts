// Hängt SSE an, mappt Server-Events auf Query-Invalidations + Toasts.
// Wird einmal in Shell mit `useLiveEvents()` gerufen.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { onSse, startSse } from "@/lib/api/sse";

export function useLiveEvents(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    startSse();

    const off = onSse(({ type, data }) => {
      switch (type) {
        case "benachrichtigung:neu": {
          qc.invalidateQueries({ queryKey: ["benachrichtigungen"] });
          qc.invalidateQueries({ queryKey: ["aktivitaeten"] });
          const d = data as { prioritaet?: string; titel?: string };
          if (d?.titel) {
            const fn = d.prioritaet === "fehler" ? toast.error
              : d.prioritaet === "warnung" ? toast.warning
              : d.prioritaet === "erfolg" ? toast.success
              : toast.info;
            fn(d.titel);
          }
          break;
        }
        case "benachrichtigung:gelesen":
        case "benachrichtigung:weg":
          qc.invalidateQueries({ queryKey: ["benachrichtigungen"] });
          break;

        case "aktivitaet:neu":
          qc.invalidateQueries({ queryKey: ["aktivitaeten"] });
          break;

        case "beleg:mutated": {
          const d = data as { art?: "angebot" | "rechnung"; id?: string };
          if (d?.art === "rechnung") {
            qc.invalidateQueries({ queryKey: ["rechnungen"] });
            if (d.id) qc.invalidateQueries({ queryKey: ["rechnungen", d.id] });
          } else if (d?.art === "angebot") {
            qc.invalidateQueries({ queryKey: ["angebote"] });
            if (d.id) qc.invalidateQueries({ queryKey: ["angebote", d.id] });
          }
          qc.invalidateQueries({ queryKey: ["dashboard", "kennzahlen"] });
          break;
        }
        case "zahlung:erfasst":
          qc.invalidateQueries({ queryKey: ["rechnungen"] });
          qc.invalidateQueries({ queryKey: ["dashboard", "kennzahlen"] });
          break;

        case "email:gesendet":
        case "email:fehler":
        case "drive:hochgeladen":
        case "drive:fehler":
          qc.invalidateQueries({ queryKey: ["email"] });
          qc.invalidateQueries({ queryKey: ["drive"] });
          qc.invalidateQueries({ queryKey: ["aktivitaeten"] });
          break;

        case "backup:erstellt":
        case "backup:fehler":
          qc.invalidateQueries({ queryKey: ["backups"] });
          break;

        case "einstellung:geaendert":
          qc.invalidateQueries({ queryKey: ["einstellungen"] });
          break;
      }
    });

    return off;
  }, [enabled, qc]);
}
