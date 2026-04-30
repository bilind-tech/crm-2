import { createFileRoute, Link } from "@tanstack/react-router";
import { useAngebot } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import { summenRechnung } from "@/lib/mock/backend";
export const Route = createFileRoute("/angebote/$id")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  const { data: a } = useAngebot(id);
  if (!a) return <p className="text-sm">Lade …</p>;
  const s = summenRechnung(a.positionen, a.rabattGesamt);
  return (
    <div className="space-y-4">
      <div><Link to="/angebote" className="text-xs text-muted-foreground hover:underline">← Angebote</Link>
        <h1 className="text-2xl font-semibold">{a.nummer}</h1>
        <p className="text-sm text-muted-foreground">{a.titel} · Status: {a.status}</p>
      </div>
      <Card><CardHeader><CardTitle>Positionen</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2">Beschreibung</th><th>Menge</th><th>Preis</th><th className="text-right">Summe</th></tr></thead>
            <tbody>
              {a.positionen.map((p) => (
                <tr key={p.id} className="border-t"><td className="py-2">{p.beschreibung}</td><td>{p.menge} {p.einheit}</td><td>{formatEUR(p.einzelpreisNetto)}</td><td className="text-right">{formatEUR(p.menge * p.einzelpreisNetto)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t"><td colSpan={3} className="py-2 text-right text-muted-foreground">Netto</td><td className="text-right">{formatEUR(s.netto)}</td></tr>
              <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Steuer</td><td className="text-right">{formatEUR(s.steuer)}</td></tr>
              <tr className="font-semibold"><td colSpan={3} className="py-2 text-right">Brutto</td><td className="text-right">{formatEUR(s.brutto)}</td></tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">PDF-Vorschau, Versand und „in Rechnung umwandeln" folgen in der nächsten Iteration.</p>
    </div>
  );
}
