import { createFileRoute, Link } from "@tanstack/react-router";
import { useRechnung } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEUR, formatDate } from "@/lib/format";
import { summenRechnung } from "@/lib/mock/backend";
export const Route = createFileRoute("/rechnungen/$id")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  const { data: r } = useRechnung(id);
  if (!r) return <p className="text-sm">Lade …</p>;
  const s = summenRechnung(r.positionen, r.rabattGesamt);
  const bezahlt = r.zahlungen.reduce((a, z) => a + z.betrag, 0);
  return (
    <div className="space-y-4">
      <div><Link to="/rechnungen" className="text-xs text-muted-foreground hover:underline">← Rechnungen</Link>
        <h1 className="text-2xl font-semibold">{r.nummer}</h1>
        <p className="text-sm text-muted-foreground">{r.titel} · Fällig {formatDate(r.faelligkeitsdatum)} · Status {r.status}</p>
      </div>
      <Card><CardHeader><CardTitle>Beträge</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
          <div><p className="text-muted-foreground">Brutto</p><p className="text-lg font-semibold">{formatEUR(s.brutto)}</p></div>
          <div><p className="text-muted-foreground">Bezahlt</p><p className="text-lg font-semibold">{formatEUR(bezahlt)}</p></div>
          <div><p className="text-muted-foreground">Offen</p><p className="text-lg font-semibold">{formatEUR(Math.max(0, s.brutto - bezahlt))}</p></div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Zahlungs-Erfassung, PDF-Vorschau und Versand folgen in der nächsten Iteration.</p>
    </div>
  );
}
