import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useDashboardKennzahlen,
  useUmsatz,
  useWarnungen,
  useAktivitaeten,
} from "@/hooks/useApi";
import { formatEUR, formatDateTime } from "@/lib/format";
import { AlertTriangle, Building2, FileText, Receipt, Users, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: k } = useDashboardKennzahlen();
  const { data: umsatz = [] } = useUmsatz();
  const { data: warnungen = [] } = useWarnungen();
  const { data: aktivitaeten = [] } = useAktivitaeten();

  const kpis = [
    { label: "Aktive Kunden", value: k?.aktiveKunden ?? 0, icon: Users, link: "/kunden" as const },
    { label: "Aktive Objekte", value: k?.aktiveObjekte ?? 0, icon: Building2, link: "/objekte" as const },
    { label: "Offene Angebote", value: k?.offeneAngebote ?? 0, icon: FileText, link: "/angebote" as const },
    { label: "Offene Rechnungen", value: k?.offeneRechnungen ?? 0, icon: Receipt, link: "/rechnungen" as const },
    { label: "Außenstände", value: formatEUR(k?.ausstehendEUR ?? 0), icon: Wallet, link: "/rechnungen" as const, wide: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Dein Überblick über Kunden, Belege und offene Beträge.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.link} className="block">
            <Card className="h-full transition hover:border-primary hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                  <p className="truncate text-lg font-semibold">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Umsatz · letzte 12 Monate</CardTitle>
            <CardDescription>Brutto pro Monat</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={umsatz}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v))} €`} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => formatEUR(v)}
                />
                <Bar dataKey="brutto" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Hinweise
            </CardTitle>
            <CardDescription>Was deine Aufmerksamkeit braucht</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {warnungen.length === 0 && (
              <p className="text-sm text-muted-foreground">Aktuell keine Warnungen — alles im grünen Bereich.</p>
            )}
            {warnungen.map((w) => (
              <div
                key={w.id}
                className={`rounded-lg border p-3 text-sm ${
                  w.schwere === "fehler"
                    ? "border-destructive/40 bg-destructive/5"
                    : w.schwere === "warnung"
                    ? "border-warning/40 bg-warning/5"
                    : "border-border bg-muted/40"
                }`}
              >
                {w.text}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Aktivitäten</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {aktivitaeten.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">{a.beschreibung}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {formatDateTime(a.zeitpunkt)}
                </Badge>
              </li>
            ))}
            {aktivitaeten.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">Noch keine Aktivitäten.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
