// Einstellungen für Zahlungsabgleich (Auto-Zuordnen Schwellwert).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save as SaveIcon, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useZahlungsabgleichEinstellungen,
  useUpdateZahlungsabgleichEinstellungen,
} from "@/hooks/useZahlungseingaenge";

export function ZahlungsabgleichTab() {
  const { data } = useZahlungsabgleichEinstellungen();
  const update = useUpdateZahlungsabgleichEinstellungen();
  const [aktiv, setAktiv] = useState(false);
  const [schwelle, setSchwelle] = useState(95);

  useEffect(() => {
    if (!data) return;
    setAktiv(data.autoZuordnenAbScore > 0);
    setSchwelle(data.autoZuordnenAbScore > 0 ? data.autoZuordnenAbScore : 95);
  }, [data]);

  if (!data) return null;
  const dirty =
    (aktiv ? schwelle : 0) !== data.autoZuordnenAbScore;

  const speichern = () => {
    update.mutate(
      { autoZuordnenAbScore: aktiv ? schwelle : 0 },
      { onSuccess: () => toast.success("Zahlungsabgleich gespeichert") },
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Automatische Zuordnung</h2>
            <p className="text-sm text-muted-foreground">
              Beim Import oder manuellen Erfassen prüft Lovable Score 0–100.
              Ab dem Schwellwert wird der Eingang ohne Klick einer Rechnung zugeordnet.
            </p>
          </div>
          <Wand2 className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium">Auto-Zuordnung aktiv</p>
            <p className="text-xs text-muted-foreground">
              Sicher empfohlen ab Score 90.
            </p>
          </div>
          <Switch checked={aktiv} onCheckedChange={setAktiv} />
        </div>

        {aktiv && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Score-Schwelle</Label>
              <Input
                type="number"
                min={50}
                max={100}
                value={schwelle}
                onChange={(e) => setSchwelle(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Werte unter 80 können zu falschen Zuordnungen führen.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          className="gap-1.5 rounded-full px-5 shadow-sm"
          onClick={speichern}
          disabled={!dirty || update.isPending}
        >
          <SaveIcon className="h-4 w-4" />
          Speichern
        </Button>
      </div>
    </div>
  );
}
