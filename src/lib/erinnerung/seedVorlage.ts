// Stellt sicher, dass die Standard-Vorlage „Zahlungserinnerung (freundlich)"
// existiert. Beim ersten Render der Dashboard-Karte oder des Popups wird die
// Vorlage einmalig angelegt, falls sie noch nicht da ist. Liefert die ID
// der Vorlage zurück (oder undefined solange noch geladen / angelegt wird).

import { useEffect, useMemo, useRef } from "react";
import { useEmailVorlagen, useCreateEmailVorlage } from "@/hooks/useApi";

const NAME = "Zahlungserinnerung (freundlich) v2";

const BETREFF = "Freundliche Erinnerung: Rechnung {{rechnung.nummer}}";

const KOERPER = `<p>{{anrede.zeile}}</p>
<p>kurze, freundliche Erinnerung: unsere Rechnung <strong>{{rechnung.nummer}}</strong> vom {{rechnung.datum}} über {{rechnung.summe}} ist seit dem {{rechnung.faellig}} fällig und bislang noch nicht beglichen.</p>
<p>Es ist gut möglich, dass das im Alltag einfach untergegangen ist — kein Problem. Falls die Zahlung bereits unterwegs ist, ist diese Mail natürlich gegenstandslos.</p>
<p><strong>Offener Betrag:</strong> {{rechnung.offen}}<br/>
<strong>Bank:</strong> {{firma.bank}}<br/>
<strong>IBAN:</strong> {{firma.iban}}<br/>
<strong>Verwendungszweck:</strong> {{rechnung.nummer}}</p>
<p>Vielen Dank für die kurze Prüfung.</p>`;

export function useErinnerungVorlageId(): string | undefined {
  const { data: vorlagen = [], isLoading } = useEmailVorlagen();
  const create = useCreateEmailVorlage();
  const tried = useRef(false);

  const found = useMemo(
    () => vorlagen.find((v) => v.name === NAME && v.kontext === "rechnung"),
    [vorlagen],
  );

  useEffect(() => {
    if (isLoading) return;
    if (found) return;
    if (tried.current) return;
    tried.current = true;
    create.mutate({
      name: NAME,
      kontext: "rechnung",
      betreff: BETREFF,
      koerperHtml: KOERPER,
      istStandard: false,
    });
  }, [isLoading, found, create]);

  return found?.id;
}