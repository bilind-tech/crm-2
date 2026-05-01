// Berechnet Match-Vorschläge zwischen einem Zahlungseingang und offenen Rechnungen.

import { useMemo } from "react";
import { useRechnungen, useKunden } from "@/hooks/useApi";
import { summenRechnung } from "@/lib/mock/backend";
import { topVorschlaege, type MatchKontext, type MatchResult } from "@/lib/zahlung/match";
import type { Zahlungseingang, Rechnung, Kunde } from "@/lib/api/types";

const OFFEN_STATUS = new Set(["versendet", "ueberfaellig", "teilbezahlt"]);

export function useMatchVorschlaege(
  tx: Zahlungseingang | null | undefined,
  n = 5,
): { vorschlaege: MatchResult[]; offene: Rechnung[]; kunden: Kunde[] } {
  const { data: rechnungen = [] } = useRechnungen();
  const { data: kunden = [] } = useKunden();

  return useMemo(() => {
    const offene = rechnungen.filter((r) => OFFEN_STATUS.has(r.status));
    if (!tx) return { vorschlaege: [], offene, kunden };
    const offeneAnzahlProKunde = new Map<string, number>();
    for (const r of offene) {
      offeneAnzahlProKunde.set(r.kundeId, (offeneAnzahlProKunde.get(r.kundeId) ?? 0) + 1);
    }
    const kontexte: MatchKontext[] = offene.map((r) => {
      const s = summenRechnung(r.positionen, r.rabattGesamt);
      const bezahlt = r.zahlungen.reduce((a, z) => a + z.betrag, 0);
      return {
        rechnung: r,
        kunde: kunden.find((k) => k.id === r.kundeId),
        brutto: s.brutto,
        bezahlt,
        offeneAnzahlKunde: offeneAnzahlProKunde.get(r.kundeId) ?? 1,
      };
    });
    return { vorschlaege: topVorschlaege(tx, kontexte, n), offene, kunden };
  }, [tx, rechnungen, kunden, n]);
}
