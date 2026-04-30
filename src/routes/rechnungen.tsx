import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRechnungen } from "@/hooks/useApi";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
export const Route = createFileRoute("/rechnungen")({ component: Page });
function Page() {
  const { data = [] } = useRechnungen();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Rechnungen</h1><p className="text-sm text-muted-foreground">{data.length} Einträge</p></div>
        <Button asChild><Link to="/rechnungen/neu"><Plus className="mr-1 h-4 w-4" />Neue Rechnung</Link></Button>
      </div>
      <Card><CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.map((r) => (
              <li key={r.id}>
                <Link to="/rechnungen/$id" params={{ id: r.id }} className="flex items-center justify-between py-3 hover:text-primary">
                  <div><p className="font-medium">{r.nummer} – {r.titel}</p><p className="text-xs text-muted-foreground">Fällig: {formatDate(r.faelligkeitsdatum)}</p></div>
                  <Badge variant={r.status === "ueberfaellig" ? "destructive" : "secondary"}>{r.status}</Badge>
                </Link>
              </li>
            ))}
            {data.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Keine Rechnungen vorhanden.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
