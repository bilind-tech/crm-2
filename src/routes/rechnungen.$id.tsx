import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, ChevronRight, Download, Send, CheckCircle2 } from "lucide-react";
import { useRechnung, useSendeRechnung, useAddZahlung } from "@/hooks/useApi";
import { useRechnungPdf } from "@/hooks/useBelegPdf";
import { Button } from "@/components/ui/button";
import { formatEUR, formatDate, todayISO } from "@/lib/format";
import { summenRechnung } from "@/lib/mock/backend";
import { toast } from "sonner";

export const Route = createFileRoute("/rechnungen/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { data: r } = useRechnung(id);
  const send = useSendeRechnung(id);
  const addZahlung = useAddZahlung(id);
  const pdf = useRechnungPdf(r);

  if (!r) return <p className="text-sm text-muted-foreground">Lade …</p>;
  const s = summenRechnung(r.positionen, r.rabattGesamt);
  const bezahlt = r.zahlungen.reduce((a, z) => a + z.betrag, 0);
  const offen = Math.max(0, s.brutto - bezahlt);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="flex items-center hover:text-foreground"><Home className="h-3.5 w-3.5" /></Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/rechnungen" className="hover:text-foreground">Rechnungen</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{r.nummer}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{r.titel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{r.nummer}</span> · {formatDate(r.rechnungsdatum)} · fällig {formatDate(r.faelligkeitsdatum)} · Status <span className="capitalize">{r.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pdf.url && (
            <Button asChild variant="outline" className="rounded-full">
              <a href={pdf.url} download={`${r.nummer}.pdf`}>
                <Download className="mr-1.5 h-4 w-4" /> PDF herunterladen
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => send.mutate(undefined, { onSuccess: () => toast.success("Rechnung versendet") })}
          >
            <Send className="mr-1.5 h-4 w-4" /> Senden
          </Button>
          {offen > 0 && (
            <Button
              className="rounded-full"
              onClick={() => {
                addZahlung.mutate(
                  { datum: todayISO(), betrag: offen, methode: "ueberweisung" },
                  { onSuccess: () => toast.success(`${formatEUR(offen)} als bezahlt erfasst`) }
                );
              }}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Bezahlt markieren
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Beträge</p>
            <Row label="Netto" value={formatEUR(s.netto)} />
            <Row label={`MwSt ${r.steuersatz}%`} value={formatEUR(s.steuer)} />
            <div className="my-2 h-px bg-border" />
            <Row label="Brutto" value={formatEUR(s.brutto)} />
            <Row label="Bezahlt" value={formatEUR(bezahlt)} />
            <Row label="Offen" value={formatEUR(offen)} bold />
          </div>

          {r.zahlungen.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zahlungen</p>
              <ul className="space-y-2 text-sm">
                {r.zahlungen.map((z) => (
                  <li key={z.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{formatDate(z.datum)} · {z.methode}</span>
                    <span className="font-medium">{formatEUR(z.betrag)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.optionen && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Optionen</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>{r.optionen.materialBereitgestellt ? "✓" : "✗"} Material bereitgestellt</li>
                <li>{r.optionen.standardAnschreiben ? "✓" : "✗"} Standard-Anschreiben</li>
                <li>{r.optionen.wiederkehrend ? "✓" : "✗"} Wiederkehrend</li>
              </ul>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-muted/40 shadow-sm">
          {pdf.status === "loading" && (
            <div className="grid h-[800px] place-content-center text-sm text-muted-foreground">PDF wird erzeugt …</div>
          )}
          {pdf.status === "error" && (
            <div className="grid h-[800px] place-content-center px-6 text-center text-sm text-destructive">
              PDF konnte nicht erzeugt werden.<br />{pdf.error}
            </div>
          )}
          {pdf.url && <iframe title="Rechnung PDF" src={pdf.url} className="block h-[900px] w-full border-0" />}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "text-lg font-semibold text-primary" : "font-medium"}>{value}</span>
    </div>
  );
}
