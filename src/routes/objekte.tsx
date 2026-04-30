import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useObjekte } from "@/hooks/useApi";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/objekte")({ component: Page });
function Page() {
  const { data: objekte = [] } = useObjekte();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Objekte</h1><p className="text-sm text-muted-foreground">{objekte.length} Einträge</p></div>
        <Button asChild><Link to="/objekte/neu"><Plus className="mr-1 h-4 w-4" />Neues Objekt</Link></Button>
      </div>
      <Card><CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {objekte.map((o) => (
              <li key={o.id}>
                <Link to="/objekte/$id" params={{ id: o.id }} className="flex items-center justify-between py-3 hover:text-primary">
                  <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.nummer} · {o.ort ?? "—"} · {o.frequenz}</p></div>
                  <span className="text-xs text-muted-foreground">{o.qmZuReinigen ?? "—"} m²</span>
                </Link>
              </li>
            ))}
            {objekte.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Noch keine Objekte angelegt.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
