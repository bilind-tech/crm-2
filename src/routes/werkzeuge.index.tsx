// Hub-Seite "Werkzeuge" — Sammelseite für PDF-Helfer und kleine Tools.
// Erweiterbar via src/lib/werkzeuge/registry.ts.
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { WerkzeugCard } from "@/components/werkzeuge/WerkzeugCard";
import { WERKZEUGE, WERKZEUG_GRUPPEN } from "@/lib/werkzeuge/registry";

export const Route = createFileRoute("/werkzeuge/")({ component: WerkzeugeHub });

function WerkzeugeHub() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Werkzeuge"
        subtitle="PDF-Vorlagen und schnelle Helfer für den Alltag. Erweiterbar."
      />

      {WERKZEUG_GRUPPEN.map((gruppe) => {
        const items = WERKZEUGE.filter((w) => w.gruppe === gruppe);
        if (items.length === 0) return null;
        return (
          <section key={gruppe} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {gruppe}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((w) => (
                <WerkzeugCard key={w.id} werkzeug={w} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
