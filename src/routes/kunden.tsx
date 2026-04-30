import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useKunden } from "@/hooks/useApi";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/kunden")({ component: Page });

function Page() {
  const { data: kunden = [], isLoading } = useKunden();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kunden</h1>
          <p className="text-sm text-muted-foreground">{kunden.length} Einträge</p>
        </div>
        <Button asChild>
          <Link to="/kunden/neu"><Plus className="mr-1 h-4 w-4" />Neuer Kunde</Link>
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Übersicht</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Lade …</p>}
          <ul className="divide-y">
            {kunden.map((k) => (
              <li key={k.id}>
                <Link to="/kunden/$id" params={{ id: k.id }} className="flex items-center justify-between py-3 hover:text-primary">
                  <div>
                    <p className="font-medium">{k.firmenname || `${k.vorname ?? ""} ${k.nachname ?? ""}`.trim()}</p>
                    <p className="text-xs text-muted-foreground">{k.nummer} · {k.ort ?? "—"}</p>
                  </div>
                  <Badge variant="secondary">{k.status}</Badge>
                </Link>
              </li>
            ))}
            {!isLoading && kunden.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">Noch keine Kunden angelegt.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
