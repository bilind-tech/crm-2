// Auto-Pop-up oben rechts: schlägt freundliche Zahlungserinnerungen vor.
// Wird nur angezeigt, wenn mind. eine Rechnung ≥ 14 Tage überfällig ist
// und seit der letzten Erinnerung ≥ 7 Tage vergangen sind.
//
// Pro Zeile gibt es einen „Erinnerung senden"-Button, der den
// EmailVersandDialog mit der vorbelegten Vorlage „Zahlungserinnerung
// (freundlich)" öffnet. Nichts wird automatisch versendet — alles per Klick.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, X, Send } from "lucide-react";
import { useErinnerungen, type ErinnerungEintrag } from "@/hooks/useErinnerungen";
import { useErinnerungVorlageId } from "@/lib/erinnerung/seedVorlage";
import { useRechnungen, useKunde } from "@/hooks/useApi";
import { useRechnungPdf } from "@/hooks/useBelegPdf";
import { EmailVersandDialog } from "@/components/email/EmailVersandDialog";
import { formatEUR } from "@/lib/format";
import type { Rechnung } from "@/lib/api/types";

export function ErinnerungPopup() {
  const { count, eintraege } = useErinnerungen();
  const { data: rechnungen = [] } = useRechnungen();
  const [geschlossen, setGeschlossen] = useState(false);
  const [sichtbar, setSichtbar] = useState(false);
  const [emailRechnung, setEmailRechnung] = useState<Rechnung | null>(null);

  useEffect(() => {
    if (count > 0 && !geschlossen) {
      const t = setTimeout(() => setSichtbar(true), 50);
      return () => clearTimeout(t);
    }
    setSichtbar(false);
  }, [count, geschlossen]);

  const rechnungMap = useMemo(() => new Map(rechnungen.map((r) => [r.id, r])), [rechnungen]);

  if (count === 0 || geschlossen) return null;

  const anzeigen = eintraege.slice(0, 3);
  const weitere = count - anzeigen.length;

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed right-3 top-20 z-50 w-[calc(100vw-1.5rem)] max-w-sm transition-all duration-300 sm:right-4 ${
          sichtbar ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
        }`}
      >
        <div className="pointer-events-auto overflow-hidden rounded-2xl border border-warning/40 bg-card shadow-lg">
          <div className="flex items-start gap-3 border-b border-border bg-warning/5 px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-content-center rounded-full bg-warning/15 text-warning">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {count === 1
                  ? "1 Zahlungserinnerung empfohlen"
                  : `${count} Zahlungserinnerungen empfohlen`}
              </p>
              <p className="text-xs text-muted-foreground">
                Freundlicher Hinweis — keine Mahnung, keine Gebühren.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeschlossen(true)}
              aria-label="Schließen"
              className="grid h-7 w-7 shrink-0 place-content-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="divide-y divide-border">
            {anzeigen.map((e) => (
              <ErinnerungZeile
                key={e.id}
                eintrag={e}
                kundeId={rechnungMap.get(e.id)?.kundeId}
                onSenden={() => {
                  const r = rechnungMap.get(e.id);
                  if (r) setEmailRechnung(r);
                }}
              />
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
            {weitere > 0 ? (
              <span className="text-xs text-muted-foreground">+ {weitere} weitere</span>
            ) : (
              <span />
            )}
            <Link
              to="/rechnungen"
              onClick={() => setGeschlossen(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Alle Rechnungen →
            </Link>
          </div>
        </div>
      </div>

      {emailRechnung && (
        <ErinnerungLauncher
          rechnung={emailRechnung}
          onClose={() => setEmailRechnung(null)}
        />
      )}
    </>
  );
}

function ErinnerungZeile({
  eintrag,
  kundeId,
  onSenden,
}: {
  eintrag: ErinnerungEintrag;
  kundeId?: string;
  onSenden: () => void;
}) {
  const { data: kunde } = useKunde(kundeId ?? "");
  const kundeName =
    kunde?.firmenname ||
    [kunde?.vorname, kunde?.nachname].filter(Boolean).join(" ") ||
    "Kunde";
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{kundeName}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{eintrag.nummer}</span> · +{eintrag.tageUeber}{" "}
          {eintrag.tageUeber === 1 ? "Tag" : "Tage"} · offen{" "}
          <span className="font-medium text-foreground">{formatEUR(eintrag.offen)}</span>
          {eintrag.anzahlBisher > 0 ? ` · ${eintrag.anzahlBisher}. Erinnerung` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onSenden}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Send className="h-3 w-3" />
        Senden
      </button>
    </li>
  );
}

function ErinnerungLauncher({
  rechnung,
  onClose,
}: {
  rechnung: Rechnung;
  onClose: () => void;
}) {
  const { data: kunde } = useKunde(rechnung.kundeId);
  const pdf = useRechnungPdf(rechnung);
  const vorlageId = useErinnerungVorlageId();
  return (
    <EmailVersandDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      kontext="rechnung"
      kunde={kunde}
      rechnung={rechnung}
      pdfBlobUrl={pdf.url}
      pdfDateiname={`${rechnung.nummer}.pdf`}
      pdfStatus={pdf.status}
      vorbelegteVorlageId={vorlageId}
    />
  );
}