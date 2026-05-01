// Mahnungen-Cockpit: zentrale Übersicht aller mahnfähigen Rechnungen.
// KPI-Karten + sortierte Liste mit Direkt-Aktion „nächste Stufe senden".

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, Gavel, Pause, Send, Receipt } from "lucide-react";

import { PageHeader, KpiCard } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  useKunden,
  useMahnEinstellungen,
  useRechnungen,
} from "@/hooks/useApi";
import { EmailVersandDialog } from "@/components/email/EmailVersandDialog";
import { useRechnungPdf } from "@/hooks/useBelegPdf";
import {
  bestimmeMahnZustand,
  dringlichkeitScore,
  stufenLabel,
  type MahnZustand,
} from "@/lib/mahnung/regeln";
import { formatDate, formatEUR } from "@/lib/format";
import type {
  Kunde,
  MahnEinstellungen,
  MahnStufe,
  Rechnung,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mahnungen")({ component: Page });

type Filter = "alle" | "ueberfaellig" | "vorgeschlagen" | "pausiert" | "inkasso";

function Page() {
  const { data: rechnungen = [] } = useRechnungen();
  const { data: kunden = [] } = useKunden();
  const { data: einstellungen } = useMahnEinstellungen();
  const [filter, setFilter] = useState<Filter>("alle");
  const [aktive, setAktive] = useState<{ rechnung: Rechnung; stufe: MahnStufe } | null>(
    null,
  );

  const kundenMap = useMemo(() => {
    const m = new Map<string, Kunde>();
    kunden.forEach((k) => m.set(k.id, k));
    return m;
  }, [kunden]);

  const items = useMemo(() => {
    if (!einstellungen) return [];
    return rechnungen
      .map((r) => ({
        rechnung: r,
        zustand: bestimmeMahnZustand(r, einstellungen),
      }))
      .filter((x) => x.zustand.istMahnfaehig || (x.rechnung.mahnungen ?? []).length > 0)
      .sort((a, b) => dringlichkeitScore(b.zustand) - dringlichkeitScore(a.zustand));
  }, [rechnungen, einstellungen]);

  const kpi = useMemo(() => {
    const ueberfaellig = items.filter((i) => i.zustand.tageUeberfaellig > 0);
    const vorgeschlagen = items.filter((i) => i.zustand.empfohleneStufe !== null);
    const pausiert = items.filter((i) => i.zustand.istPausiert);
    const inkasso = items.filter((i) => i.rechnung.inkassoMarkiert);
    const offenSumme = ueberfaellig.reduce((acc, i) => acc + i.zustand.offenEUR, 0);
    return {
      ueberfaellig: ueberfaellig.length,
      vorgeschlagen: vorgeschlagen.length,
      pausiert: pausiert.length,
      inkasso: inkasso.length,
      offenSumme,
    };
  }, [items]);

  const gefiltert = useMemo(() => {
    switch (filter) {
      case "ueberfaellig":
        return items.filter((i) => i.zustand.tageUeberfaellig > 0);
      case "vorgeschlagen":
        return items.filter((i) => i.zustand.empfohleneStufe !== null);
      case "pausiert":
        return items.filter((i) => i.zustand.istPausiert);
      case "inkasso":
        return items.filter((i) => i.rechnung.inkassoMarkiert);
      default:
        return items;
    }
  }, [items, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mahnwesen"
        subtitle="Alle offenen Forderungen mit Vorschlag der nächsten Eskalationsstufe."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Überfällig"
          value={kpi.ueberfaellig}
          sublabel={`Σ ${formatEUR(kpi.offenSumme)} offen`}
          icon={AlertTriangle}
          tone="danger"
        />
        <KpiCard
          label="Aktion empfohlen"
          value={kpi.vorgeschlagen}
          sublabel="Mahnung sollte raus"
          icon={Bell}
          tone="primary"
        />
        <KpiCard
          label="Pausiert"
          value={kpi.pausiert}
          sublabel="z.B. Zahlungszusage"
          icon={Pause}
        />
        <KpiCard
          label="Inkasso"
          value={kpi.inkasso}
          sublabel="übergeben"
          icon={Gavel}
          tone="danger"
        />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
        {(
          [
            { id: "alle", label: `Alle (${items.length})` },
            { id: "vorgeschlagen", label: `Aktion empfohlen (${kpi.vorgeschlagen})` },
            { id: "ueberfaellig", label: `Überfällig (${kpi.ueberfaellig})` },
            { id: "pausiert", label: `Pausiert (${kpi.pausiert})` },
            { id: "inkasso", label: `Inkasso (${kpi.inkasso})` },
          ] as { id: Filter; label: string }[]
        ).map((t) => {
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {gefiltert.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <Receipt className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-base font-medium">Keine Einträge</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Rechnungen sind im grünen Bereich.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <ul className="divide-y divide-border">
            {gefiltert.map((item) => (
              <MahnungZeile
                key={item.rechnung.id}
                rechnung={item.rechnung}
                zustand={item.zustand}
                kunde={kundenMap.get(item.rechnung.kundeId)}
                einstellungen={einstellungen!}
                onSenden={(stufe) => setAktive({ rechnung: item.rechnung, stufe })}
              />
            ))}
          </ul>
        </div>
      )}

      {aktive && (
        <MahnEmailDialog
          rechnung={aktive.rechnung}
          stufe={aktive.stufe}
          kunde={kundenMap.get(aktive.rechnung.kundeId)}
          onClose={() => setAktive(null)}
        />
      )}
    </div>
  );
}

function MahnungZeile({
  rechnung,
  zustand,
  kunde,
  einstellungen,
  onSenden,
}: {
  rechnung: Rechnung;
  zustand: MahnZustand;
  kunde?: Kunde;
  einstellungen: MahnEinstellungen;
  onSenden: (stufe: MahnStufe) => void;
}) {
  const kundenName =
    kunde?.firmenname ||
    [kunde?.vorname, kunde?.nachname].filter(Boolean).join(" ") ||
    "—";

  const aktuelle = zustand.letzteVersendeteStufe;
  const empfehlung = zustand.empfohleneStufe;

  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-muted/30">
      {/* Stufe-Indikator */}
      <div className="flex shrink-0 items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "grid h-6 w-6 place-content-center rounded-full text-[10px] font-semibold",
              aktuelle >= n
                ? "bg-success text-success-foreground"
                : empfehlung === n
                  ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {n}
          </span>
        ))}
        {rechnung.inkassoMarkiert && (
          <Gavel className="ml-1 h-4 w-4 text-destructive" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Link
          to="/rechnungen/$id"
          params={{ id: rechnung.id }}
          className="block truncate text-sm font-semibold hover:text-primary"
        >
          <span className="font-mono">{rechnung.nummer}</span> · {kundenName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          fällig {formatDate(rechnung.faelligkeitsdatum)}
          {zustand.tageUeberfaellig > 0 && (
            <> · {zustand.tageUeberfaellig} Tage überfällig</>
          )}
          {zustand.istPausiert && (
            <> · pausiert bis {formatDate(zustand.pausiertBis!)}</>
          )}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold">{formatEUR(zustand.offenEUR)}</p>
        <p className="text-[11px] text-muted-foreground">offen</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {empfehlung && !zustand.istPausiert && !rechnung.inkassoMarkiert ? (
          <Button size="sm" className="rounded-lg" onClick={() => onSenden(empfehlung)}>
            <Send className="mr-1.5 h-4 w-4" />
            {stufenLabel(empfehlung, einstellungen)} senden
          </Button>
        ) : zustand.istInkassoReif && !rechnung.inkassoMarkiert ? (
          <Button size="sm" variant="outline" className="rounded-lg" asChild>
            <Link to="/rechnungen/$id" params={{ id: rechnung.id }}>
              Inkasso prüfen →
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="rounded-lg" asChild>
            <Link to="/rechnungen/$id" params={{ id: rechnung.id }}>
              Details
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

// Lazy-Wrapper, der für den Versand das PDF erzeugt.
function MahnEmailDialog({
  rechnung,
  stufe,
  kunde,
  onClose,
}: {
  rechnung: Rechnung;
  stufe: MahnStufe;
  kunde?: Kunde;
  onClose: () => void;
}) {
  const pdf = useRechnungPdf(rechnung);
  return (
    <EmailVersandDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      kontext="mahnung"
      kunde={kunde ?? null}
      rechnung={rechnung}
      pdfBlobUrl={pdf.url}
      pdfDateiname={`${rechnung.nummer}.pdf`}
      mahnStufe={stufe}
    />
  );
}
