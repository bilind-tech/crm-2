import { useState, useEffect } from "react";
import { LoadingPlaceholder } from "@/components/layout/LoadingPlaceholder";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useDauerauftragEinstellungen,
  useUpdateDauerauftragEinstellungen,
} from "@/hooks/useDauerauftraege";
import type { DauerauftragEinstellungen } from "@/lib/api/types";

export function DauerauftragTab() {
  const { data, isLoading, error } = useDauerauftragEinstellungen();
  const update = useUpdateDauerauftragEinstellungen();
  const [form, setForm] = useState<DauerauftragEinstellungen | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold">
          Dauerauftrags-Einstellungen konnten nicht geladen werden
        </h3>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unbekannter Fehler"}
        </p>
      </div>
    );
  }

  if (isLoading || !form) return <LoadingPlaceholder />;

  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Standardeinstellungen für Daueraufträge</h2>
          <p className="text-sm text-muted-foreground">
            Werden bei neuen Daueraufträgen vorausgewählt.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-medium" htmlFor="laufzeit">
              Vorlaufzeit (Tage vor Fälligkeit)
            </Label>
            <Input
              id="laufzeit"
              type="number"
              min={0}
              max={60}
              value={form.laufzeitTagBeforeFaellig}
              onChange={(e) =>
                setForm({
                  ...form,
                  laufzeitTagBeforeFaellig: Math.min(60, Math.max(0, Number(e.target.value) || 0)),
                })
              }
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Wie viele Tage vor dem Fälligkeitstermin der Lauf vorbereitet wird (0–60).
            </p>
          </div>

          <div>
            <Label className="text-xs font-medium">Automatische Rechnungserzeugung</Label>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <Switch
                checked={form.autoVersand}
                onCheckedChange={(v) => setForm({ ...form, autoVersand: v })}
              />
              <span className="text-sm">
                {form.autoVersand ? "Aktiviert" : "Deaktiviert"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Erzeugt am Stichtag automatisch eine Rechnung. E-Mails werden trotzdem nie
              automatisch versendet — Versand bleibt immer ein bewusster Klick.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!dirty || update.isPending}
          onClick={() =>
            update.mutate(form, { onSuccess: () => toast.success("Einstellungen gespeichert") })
          }
        >
          <Save className="mr-1.5 h-4 w-4" /> Speichern
        </Button>
      </div>
    </div>
  );
}
