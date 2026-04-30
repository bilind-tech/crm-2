import { createFileRoute, Link } from "@tanstack/react-router";
import { useKunde } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/kunden/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { data: k, isLoading } = useKunde(id);
  if (isLoading) return <p className="text-sm text-muted-foreground">Lade …</p>;
  if (!k) return <p className="text-sm">Kunde nicht gefunden. <Link to="/kunden" className="underline">Zurück</Link></p>;
  return (
    <div className="space-y-4">
      <div>
        <Link to="/kunden" className="text-xs text-muted-foreground hover:underline">← Kunden</Link>
        <h1 className="text-2xl font-semibold">{k.firmenname || `${k.vorname ?? ""} ${k.nachname ?? ""}`.trim()}</h1>
        <p className="text-sm text-muted-foreground">{k.nummer}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Stammdaten</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Adresse: </span>{[k.strasse, `${k.plz ?? ""} ${k.ort ?? ""}`.trim(), k.land].filter(Boolean).join(", ") || "—"}</div>
          <div><span className="text-muted-foreground">E-Mail: </span>{k.email ?? "—"}</div>
          <div><span className="text-muted-foreground">Telefon: </span>{k.telefon ?? "—"}</div>
          <div><span className="text-muted-foreground">USt-ID: </span>{k.ustId ?? "—"}</div>
          <div><span className="text-muted-foreground">Zahlungsziel: </span>{k.zahlungszielTage} Tage</div>
          <div><span className="text-muted-foreground">Status: </span>{k.status}</div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Detaillierte Tabs (Ansprechpartner, Objekte, Angebote, Rechnungen, Dokumente, Notizen) folgen in der nächsten Iteration.
      </p>
    </div>
  );
}
