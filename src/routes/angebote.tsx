import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAngebote } from "@/hooks/useApi";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
export const Route = createFileRoute("/angebote")({ component: Page });
function Page() {
  const { data = [] } = useAngebote();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Angebote</h1><p className="text-sm text-muted-foreground">{data.length} Einträge</p></div>
        <Button asChild><Link to="/angebote/neu"><Plus className="mr-1 h-4 w-4" />Neues Angebot</Link></Button>
      </div>
      <Card><CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.map((a) => (
              <li key={a.id}>
                <Link to="/angebote/$id" params={{ id: a.id }} className="flex items-center justify-between py-3 hover:text-primary">
                  <div><p className="font-medium">{a.nummer} – {a.titel}</p><p className="text-xs text-muted-foreground">Gültig bis {formatDate(a.gueltigBis)}</p></div>
                  <Badge variant="secondary">{a.status}</Badge>
                </Link>
              </li>
            ))}
            {data.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Keine Angebote vorhanden.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
