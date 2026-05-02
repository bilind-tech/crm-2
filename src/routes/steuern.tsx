// Steuer-Übersicht für GmbH (Sankt Augustin) — vollautomatisch, read-only.
// USt: präzise aus bezahlten Rechnungen + Belegen.
// KSt/Soli/GewSt: YTD-Hochrechnung mit Hinweis.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Calculator,
  AlertCircle,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Building2,
  Info,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { useRechnungen, useDokumente } from "@/hooks/useApi";
import { useSteuerEinstellungen } from "@/lib/steuern/store";
import {
  generiereAutomatischePosten,
  berechneKennzahlen,
} from "@/lib/steuern/berechnung";
import type { SteuerPosten, SteuerArt } from "@/lib/steuern/types";
import { PageHeader, KpiCard } from "@/components/layout/PageHeader";
import { formatEUR, formatDate, daysBetween, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SteuerDetailDialog } from "@/components/steuern/SteuerDetailDialog";

export const Route = createFileRoute("/steuern")({
  head: () => ({
    meta: [
      { title: "Steuern — My Clean Center" },
      { name: "description", content: "Automatische Übersicht über Umsatzsteuer-Schuld und empfohlene Rücklage." },
    ],
  }),
  component: Page,
});

const ART_ICON: Record<SteuerArt, typeof Receipt> = {
  ust: Receipt,
  kst: Building2,
  soli: FileSpreadsheet,
  gewst: Building2,
  manuell: Calculator,
};

function Page() {
  const { data: rechnungen = [] } = useRechnungen();
  const { data: dokumente = [] } = useDokumente();
  const { data: einstellungen } = useSteuerEinstellungen();

  const [detailDialog, setDetailDialog] = useState<SteuerPosten | null>(null);

  const jahr = new Date().getFullYear();

  const allePosten = useMemo(
    () => generiereAutomatischePosten(rechnungen, dokumente, einstellungen, jahr),
    [rechnungen, dokumente, einstellungen, jahr],
  );

  const kennzahlen = useMemo(
    () => berechneKennzahlen(allePosten, rechnungen, dokumente, einstellungen, jahr),
    [allePosten, rechnungen, dokumente, einstellungen, jahr],
  );

  // Aufschlüsselung der Rücklage
  const ruecklage = useMemo(() => {
    let ust = 0;
    let kst = 0;
    let soli = 0;
    let gewst = 0;
    for (const p of allePosten) {
      if (p.art === "ust") ust += p.geschaetzterBetrag;
      else if (p.art === "kst") kst += p.geschaetzterBetrag;
      else if (p.art === "soli") soli += p.geschaetzterBetrag;
      else if (p.art === "gewst") gewst += p.geschaetzterBetrag;
    }
    return {
      ust,
      kst,
      soli,
      gewst,
      ertragsteuer: kst + soli + gewst,
      gesamt: ust + kst + soli + gewst,
    };
  }, [allePosten]);

  const offene = useMemo(
    () =>
      [...allePosten].sort((a, b) => a.faelligAm.localeCompare(b.faelligAm)),
    [allePosten],
  );

  const offeneUst = offene.filter((p) => p.art === "ust");
  const offeneErtrag = offene.filter((p) => p.art !== "ust");

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Steuern"
        subtitle="Vollautomatisch aus deinen Rechnungen und Belegen berechnet."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Umsatzsteuer-Schuld"
          value={formatEUR(ruecklage.ust)}
          sublabel="exakt aus bezahlten Rechnungen"
          tone={ruecklage.ust > 0 ? "warning" : "success"}
          icon={Receipt}
        />
        <KpiCard
          label="Nächste Fälligkeit"
          value={
            kennzahlen.naechsteFaelligkeit
              ? formatEUR(kennzahlen.naechsteFaelligkeit.geschaetzterBetrag)
              : "—"
          }
          sublabel={
            kennzahlen.naechsteFaelligkeit
              ? `${kennzahlen.naechsteFaelligkeit.titel} · ${formatDate(kennzahlen.naechsteFaelligkeit.faelligAm)}`
              : "Keine offenen Posten"
          }
          tone={kennzahlen.naechsteFaelligkeit?.status === "ueberfaellig" ? "danger" : "warning"}
          icon={AlertCircle}
        />
        <KpiCard
          label="Empfohlene Rücklage"
          value={formatEUR(ruecklage.gesamt)}
          sublabel="USt + Ertragsteuer-Schätzung"
          tone="primary"
          icon={PiggyBank}
        />
        <KpiCard
          label={`Gewinn ${jahr}`}
          value={formatEUR(kennzahlen.gewinnYtd)}
          sublabel={
            kennzahlen.gewinnYtd < 0
              ? "Verlust YTD"
              : "Netto-Einnahmen − Netto-Ausgaben"
          }
          tone={kennzahlen.gewinnYtd >= 0 ? "success" : "default"}
          icon={TrendingUp}
        />
      </div>

      {/* Rücklagen-Karte: prominent */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PiggyBank className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Was du zurücklegen solltest
            </h2>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
              {formatEUR(ruecklage.gesamt)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Damit das Finanzamt jederzeit bedient werden kann.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2.5 border-t border-border pt-5">
          <RuecklageZeile
            label="Umsatzsteuer-Schuld"
            sub="exakt — alle offenen Voranmeldungen"
            betrag={ruecklage.ust}
            ton="exakt"
          />
          <RuecklageZeile
            label="Körperschaftsteuer + Soli"
            sub={`Hochrechnung Jahr ${jahr} · ${einstellungen.kstSatz}% + ${einstellungen.soliSatz}% Soli`}
            betrag={ruecklage.kst + ruecklage.soli}
            ton="schaetzung"
          />
          <RuecklageZeile
            label="Gewerbesteuer"
            sub={`Hochrechnung Jahr ${jahr} · Hebesatz Sankt Augustin ${einstellungen.gewstHebesatz}%`}
            betrag={ruecklage.gewst}
            ton="schaetzung"
          />
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-semibold">Gesamt</span>
            <span className="text-2xl font-bold tabular-nums">{formatEUR(ruecklage.gesamt)}</span>
          </div>
        </div>
      </div>

      {/* Offene USt-Voranmeldungen */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Umsatzsteuer · {einstellungen.ustRhythmus === "monatlich" ? "monatliche Voranmeldungen" : einstellungen.ustRhythmus === "quartalsweise" ? "Quartals-Voranmeldungen" : "jährlich"}
        </h2>
        {offeneUst.length === 0 ? (
          <EmptyHinweis text="Sobald bezahlte Rechnungen oder Belege im aktuellen Voranmeldungs-Zeitraum liegen, erscheint hier die nächste USt-Voranmeldung." />
        ) : (
          <div className="space-y-2">
            {offeneUst.map((p) => (
              <PostenZeile key={p.id} posten={p} onClick={() => setDetailDialog(p)} />
            ))}
          </div>
        )}
      </div>

      {/* Offene Ertragsteuern */}
      {offeneErtrag.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ertragsteuer-Vorauszahlungen · Schätzung aus YTD-Gewinn
          </h2>
          <div className="space-y-2">
            {offeneErtrag.map((p) => (
              <PostenZeile key={p.id} posten={p} onClick={() => setDetailDialog(p)} />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Schätzung — keine Steuerberatung</p>
            <p className="mt-1">
              USt-Beträge sind exakt aus deinen bezahlten Rechnungen und steuerrelevanten Belegen berechnet.
              Ertragsteuern (KSt/Soli/GewSt) sind YTD-Hochrechnungen und werden mit jedem neuen Beleg präziser.
              Mit Steuerberater abstimmen vor Vorauszahlung oder Jahreserklärung.{" "}
              <Link to="/einstellungen" className="font-medium text-primary hover:underline">
                Steuersätze in Einstellungen anpassen
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <SteuerDetailDialog
        posten={detailDialog}
        onOpenChange={(v: boolean) => !v && setDetailDialog(null)}
      />
    </div>
  );
}

function EmptyHinweis({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <p className="font-semibold">Keine offenen Posten</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function RuecklageZeile({
  label,
  sub,
  betrag,
  ton,
}: {
  label: string;
  sub: string;
  betrag: number;
  ton: "exakt" | "schaetzung";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{label}</p>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              ton === "exakt"
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning",
            )}
          >
            {ton === "exakt" ? "exakt" : "Schätzung"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <p className="shrink-0 text-lg font-semibold tabular-nums">{formatEUR(betrag)}</p>
    </div>
  );
}

interface ZeileProps {
  posten: SteuerPosten;
  onClick: () => void;
}

function PostenZeile({ posten, onClick }: ZeileProps) {
  const Icon = ART_ICON[posten.art];
  const tageBis = daysBetween(todayISO(), posten.faelligAm);
  const isUeberfaellig = posten.status === "ueberfaellig" || tageBis < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition hover:shadow-md sm:p-4"
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          isUeberfaellig
            ? "bg-destructive/10 text-destructive"
            : posten.art === "ust"
            ? "bg-primary/10 text-primary"
            : "bg-warning/10 text-warning",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{posten.titel}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>Fällig {formatDate(posten.faelligAm)}</span>
          <span>·</span>
          <span className={cn(isUeberfaellig && "font-medium text-destructive")}>
            {tageBis < 0
              ? `${Math.abs(tageBis)} Tage überfällig`
              : tageBis === 0
              ? "heute fällig"
              : `in ${tageBis} ${tageBis === 1 ? "Tag" : "Tagen"}`}
          </span>
        </div>
      </div>
      <p
        className={cn(
          "shrink-0 text-base font-semibold tabular-nums sm:text-lg",
          isUeberfaellig && "text-destructive",
        )}
      >
        {formatEUR(posten.geschaetzterBetrag)}
      </p>
    </button>
  );
}
