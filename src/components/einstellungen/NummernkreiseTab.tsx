// Tab "Nummernkreise": Formate für Rechnungs- und Angebotsnummern + Startzähler.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useNummernkreise, useUpdateNummernkreise } from "@/hooks/useApi";
import type { Nummernkreise } from "@/lib/api/types";
import { Field, Section, StickySaveBar } from "./_shared";
import { LoadingPlaceholder } from "@/components/layout/LoadingPlaceholder";

function preview(template: string, startNummer: number): string {
  const now = new Date();
  const nn = String(Math.max(1, startNummer || 1)).padStart(2, "0");
  return template
    .replace(/\{KUERZEL\}/g, "GFU")
    .replace(/\{YYYY\}/g, String(now.getFullYear()))
    .replace(/\{YY\}/g, String(now.getFullYear()).slice(-2))
    .replace(/\{MM\}/g, String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{NN\}/g, nn)
    .replace(/\{####\}/g, nn.padStart(4, "0"))
    .replace(/\{###\}/g, nn.padStart(3, "0"));
}

function validateFormat(template: string): string | undefined {
  if (!template.trim()) return "Pflichtfeld";
  if (!/\{NN\}|\{####\}|\{###\}/.test(template))
    return "Pflicht-Platzhalter {NN} (oder {####}) fehlt";
  return undefined;
}

export function NummernkreiseTab() {
  const { data, isLoading, error } = useNummernkreise();
  const update = useUpdateNummernkreise();
  const [form, setForm] = useState<Nummernkreise | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold">Nummernkreise konnten nicht geladen werden</h3>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unbekannter Fehler"}
        </p>
      </div>
    );
  }

  if (isLoading || !form || !data) return <LoadingPlaceholder />;

  const errors = {
    rechnung: validateFormat(form.rechnungFormat),
    angebot: validateFormat(form.angebotFormat),
    start: form.startNummer < 1 ? "Mindestens 1" : undefined,
  };
  const valid = !errors.rechnung && !errors.angebot && !errors.start;
  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  const save = () => {
    if (!valid) {
      toast.error("Bitte alle Felder korrekt ausfüllen.");
      return;
    }
    update.mutate(form, { onSuccess: () => toast.success("Nummernkreise gespeichert") });
  };

  return (
    <div className="space-y-5 pb-24">
      <Section
        title="Nummernkreise"
        description="Formate für Belegnummern. Platzhalter: {KUERZEL}, {YYYY}, {YY}, {MM}, {NN}."
      >
        <div className="space-y-4">
          <Field label="Rechnungsnummer-Format" required error={errors.rechnung}>
            <Input
              value={form.rechnungFormat}
              onChange={(e) => setForm({ ...form, rechnungFormat: e.target.value })}
              className="font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Vorschau:{" "}
              <span className="font-mono text-foreground">
                {preview(form.rechnungFormat, form.startNummer)}
              </span>
            </p>
          </Field>

          <Field label="Angebotsnummer-Format" required error={errors.angebot}>
            <Input
              value={form.angebotFormat}
              onChange={(e) => setForm({ ...form, angebotFormat: e.target.value })}
              className="font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Vorschau:{" "}
              <span className="font-mono text-foreground">
                {preview(form.angebotFormat, form.startNummer)}
              </span>
            </p>
          </Field>

          <Field label="Start-Nummer (pro Kunde + Monat)" required error={errors.start}>
            <Input
              type="number"
              min={1}
              max={99999}
              value={form.startNummer}
              onChange={(e) =>
                setForm({ ...form, startNummer: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Hinweis">
        <p className="text-sm text-muted-foreground">
          Bestehende Belege behalten ihre Nummer. Nur neue Belege bekommen das aktualisierte Format.
        </p>
      </Section>

      <StickySaveBar
        dirty={dirty}
        saving={update.isPending}
        onReset={() => setForm(data)}
        onSave={save}
      />
    </div>
  );
}
