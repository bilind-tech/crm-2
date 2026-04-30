import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFirmendaten, useErscheinung, useUpdateErscheinung } from "@/hooks/useApi";
import { useTheme } from "@/lib/theme";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/einstellungen")({ component: Page });

function Page() {
  const { data: firma } = useFirmendaten();
  const { data: erscheinung } = useErscheinung();
  const updateErsch = useUpdateErscheinung();
  const { theme, setTheme, akzent, setAkzent } = useTheme();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <Card>
        <CardHeader><CardTitle>Erscheinungsbild</CardTitle><CardDescription>Theme &amp; Akzentfarbe</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Theme</Label>
            <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={theme} onChange={(e) => { const v = e.target.value as "system" | "hell" | "dunkel"; setTheme(v); updateErsch.mutate({ theme: v }); }}>
              <option value="system">System</option><option value="hell">Hell</option><option value="dunkel">Dunkel</option>
            </select>
          </div>
          <div><Label>Akzentfarbe</Label>
            <Input type="color" value={akzent} onChange={(e) => { setAkzent(e.target.value); updateErsch.mutate({ akzentfarbe: e.target.value }); }} />
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">Aktuell gespeichert: {erscheinung?.akzentfarbe ?? "—"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Firmendaten</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Firma: </span>{firma?.firmenname}</div>
          <div><span className="text-muted-foreground">USt-ID: </span>{firma?.ustId}</div>
          <div><span className="text-muted-foreground">IBAN: </span>{firma?.iban}</div>
          <div><span className="text-muted-foreground">BIC: </span>{firma?.bic}</div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Tabs für SMTP, Nummernkreise, Vorlagen, Backup, Sicherheit folgen im nächsten Schritt.
      </p>
    </div>
  );
}
