import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDokumente } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
export const Route = createFileRoute("/dokumente")({ component: Page });
function Page() {
  const { data = [] } = useDokumente();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dokumente</h1>
      <Card><CardHeader><CardTitle>Hochgeladene Dateien</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                <div><p className="font-medium">{d.titel}</p><p className="text-xs text-muted-foreground">{d.typ} · {d.dateiname}</p></div>
                <span className="text-xs text-muted-foreground">{formatDate(d.dokumentdatum)}</span>
              </li>
            ))}
            {data.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Noch keine Dokumente.</li>}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Drag-&amp;-Drop-Upload folgt im nächsten Schritt.</p>
        </CardContent>
      </Card>
    </div>
  );
}
