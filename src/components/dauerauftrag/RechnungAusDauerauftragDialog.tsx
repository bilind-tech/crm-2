import { useMemo, useState } from "react";
import { Repeat, AlertTriangle, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useDauerauftraege,
  useDauerauftragLaeufe,
  useSofortLaufBulk,
  useUpdateDauerauftrag,
} from "@/hooks/useDauerauftraege";
import { useKunden } from "@/hooks/useApi";
import { summenRechnung } from "@/lib/belege/summen";
import { formatEUR } from "@/lib/format";
import { periodeFuer, periodeBezeichnung } from "@/lib/dauerauftrag/termine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dauerauftrag, DauerauftragFrequenz } from "@/lib/api/types";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/** Liefert die zur Frequenz passende Periode `offset` Schritte ab heute. */
function periodeMitOffset(frequenz: DauerauftragFrequenz, offset: number): { key: string; label: string; datum: Date } {
  const heute = new Date();
  const monateSchritt =
    frequenz === "monatlich" ? 1 : frequenz === "quartalsweise" ? 3 : frequenz === "halbjaehrlich" ? 6 : 12;
  const d = new Date(heute.getFullYear(), heute.getMonth() + offset * monateSchritt, 1);
  // Wir brauchen ein Dummy-Dauerauftrag-Objekt nur für periodeFuer/Bezeichnung
  const fakeDa = { frequenz } as Dauerauftrag;
  return { key: periodeFuer(fakeDa, d), label: periodeBezeichnung(fakeDa, d), datum: d };
}

export function RechnungAusDauerauftragDialog({ open, onOpenChange }: Props) {
  const { data: alleDA = [] } = useDauerauftraege();
  const { data: alleLaeufe = [] } = useDauerauftragLaeufe();
  const { data: kunden = [] } = useKunden();
  const bulk = useSofortLaufBulk();

  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState<number>(0); // 0=jetzt, +1=nächste, -1=letzte
  const [bearbeiten, setBearbeiten] = useState<Dauerauftrag | null>(null);

  const kundeName = (id: string) => {
    const k = kunden.find((x) => x.id === id);
    if (!k) return "—";
    return k.firmenname || `${k.vorname ?? ""} ${k.nachname ?? ""}`.trim() || "—";
  };

  const sortiert = useMemo(() => {
    const order: Record<string, number> = { aktiv: 0, pausiert: 1, beendet: 2 };
    return [...alleDA].sort((a, b) => {
      const oa = order[a.status] ?? 3;
      const ob = order[b.status] ?? 3;
      if (oa !== ob) return oa - ob;
      return a.bezeichnung.localeCompare(b.bezeichnung);
    });
  }, [alleDA]);

  const auswaehlbar = sortiert.filter((d) => d.status !== "beendet");
  const alleAusgewaehlt = auswaehlbar.length > 0 && auswaehlbar.every((d) => auswahl.has(d.id));

  const toggleAlle = () =>
    setAuswahl(alleAusgewaehlt ? new Set() : new Set(auswaehlbar.map((d) => d.id)));
  const toggleEinzeln = (id: string) =>
    setAuswahl((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const reset = () => setAuswahl(new Set());

  const handleErzeugen = () => {
    const ids = Array.from(auswahl);
    if (ids.length === 0) return;
    // Periode hängt von Frequenz jeder DA ab → wir senden je DA seine eigene Periode
    // via einzelne Calls (Bulk-Hook nimmt einen periode-String; bei gemischten
    // Frequenzen rufen wir pro DA separat — der Bulk-Hook unterstützt nur einen Wert,
    // daher mappen wir hier: wenn alle gleiche Frequenz haben → ein Wert, sonst
    // pro DA passend nacheinander.)
    const ausgewaehlte = sortiert.filter((d) => auswahl.has(d.id));
    const freqs = new Set(ausgewaehlte.map((d) => d.frequenz));
    if (freqs.size === 1) {
      const f = ausgewaehlte[0].frequenz;
      const p = periodeMitOffset(f, offset).key;
      bulk.mutate(
        { ids, periode: p },
        {
          onSuccess: ({ erfolge, fehler }) => {
            if (erfolge > 0 && fehler === 0) toast.success(`${erfolge} Rechnung(en) erzeugt`);
            else if (erfolge > 0) toast.warning(`${erfolge} erzeugt, ${fehler} fehlgeschlagen`);
            else toast.error(`Erzeugen fehlgeschlagen (${fehler})`);
            reset();
            onOpenChange(false);
          },
        },
      );
    } else {
      // gemischte Frequenzen — pro DA seine Periode bestimmen, sequentiell aufrufen via Bulk-Hook mit Einzel-IDs
      Promise.all(
        ausgewaehlte.map((d) =>
          bulk.mutateAsync({ ids: [d.id], periode: periodeMitOffset(d.frequenz, offset).key }),
        ),
      )
        .then((results) => {
          const erfolge = results.reduce((a, r) => a + r.erfolge, 0);
          const fehler = results.reduce((a, r) => a + r.fehler, 0);
          if (erfolge > 0 && fehler === 0) toast.success(`${erfolge} Rechnung(en) erzeugt`);
          else toast.warning(`${erfolge} erzeugt, ${fehler} fehlgeschlagen`);
          reset();
          onOpenChange(false);
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Erzeugen fehlgeschlagen"));
    }
  };

  const periodenOptionen = [-1, 0, 1, 2, 3];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset();
          onOpenChange(o);
        }}
      >
        <DialogContent className="bg-background sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              Rechnungen aus Daueraufträgen erzeugen
            </DialogTitle>
            <DialogDescription>
              Wähle Periode und Daueraufträge — für jede ausgewählte Vorlage wird eine Rechnung
              erstellt.
            </DialogDescription>
          </DialogHeader>

          {sortiert.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              Noch keine Daueraufträge — leg einen an, indem du beim Anlegen einer Rechnung das
              Häkchen „Wiederkehrend" setzt.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                <Label className="text-xs font-medium text-muted-foreground">Periode</Label>
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                >
                  {periodenOptionen.map((o) => {
                    // Standard-Beispiel: monatliche Variante als Label
                    const ex = periodeMitOffset("monatlich", o);
                    const prefix =
                      o === 0 ? "Diesen Monat — " : o === 1 ? "Nächsten Monat — " : o === -1 ? "Letzten Monat — " : "";
                    return (
                      <option key={o} value={o}>
                        {prefix}
                        {ex.label}
                      </option>
                    );
                  })}
                </select>
                <span className="ml-auto text-xs text-muted-foreground">
                  Quartals-/Jahres-DA bekommen die passende Periode automatisch
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border pb-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={alleAusgewaehlt}
                    onChange={toggleAlle}
                    disabled={auswaehlbar.length === 0}
                  />
                  <span className="font-medium">
                    {alleAusgewaehlt ? "Auswahl aufheben" : "Alle auswählen"}
                  </span>
                </label>
                <span className="text-xs text-muted-foreground">{auswahl.size} ausgewählt</span>
              </div>

              <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto">
                {sortiert.map((da) => {
                  const beendet = da.status === "beendet";
                  const checked = auswahl.has(da.id);
                  const s = summenRechnung(da.positionen, da.rabattGesamt);
                  const periodeKey = periodeMitOffset(da.frequenz, offset).key;
                  const periodeLabel = periodeMitOffset(da.frequenz, offset).label;
                  const bereitsErzeugt = alleLaeufe.some(
                    (l) => l.dauerauftragId === da.id && l.periode === periodeKey,
                  );
                  return (
                    <li key={da.id} className="flex items-start gap-2 px-1 py-3">
                      <label
                        className={`flex flex-1 cursor-pointer items-start gap-3 text-sm ${
                          beendet ? "cursor-not-allowed opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                          checked={checked}
                          disabled={beendet}
                          onChange={() => !beendet && toggleEinzeln(da.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium">{da.bezeichnung}</p>
                            <StatusPill status={da.status} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {kundeName(da.kundeId)} ·{" "}
                            <span className="capitalize">{da.frequenz}</span> ·{" "}
                            <span className="font-medium text-foreground">
                              {formatEUR(s.brutto)}
                            </span>{" "}
                            / Lauf · Periode <span className="font-medium">{periodeLabel}</span>
                          </p>
                          {bereitsErzeugt && !beendet && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-warning">
                              <AlertTriangle className="h-3 w-3" />
                              bereits erzeugt für {periodeKey}
                            </p>
                          )}
                        </div>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setBearbeiten(da)}
                        title="Dauerauftrag bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => onOpenChange(false)}
              disabled={bulk.isPending}
            >
              Abbrechen
            </Button>
            <Button
              className="rounded-lg"
              onClick={handleErzeugen}
              disabled={auswahl.size === 0 || bulk.isPending}
            >
              {bulk.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Erzeuge …
                </>
              ) : (
                <>Erzeugen ({auswahl.size})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {bearbeiten && (
        <DauerauftragEditDialog
          da={bearbeiten}
          onClose={() => setBearbeiten(null)}
        />
      )}
    </>
  );
}

function DauerauftragEditDialog({ da, onClose }: { da: Dauerauftrag; onClose: () => void }) {
  const update = useUpdateDauerauftrag(da.id);
  const [bezeichnung, setBezeichnung] = useState(da.bezeichnung);
  const [frequenz, setFrequenz] = useState<DauerauftragFrequenz>(da.frequenz);
  const [status, setStatus] = useState(da.status);
  const [steuersatz, setSteuersatz] = useState(da.steuersatz);
  const [rabattGesamt, setRabattGesamt] = useState(da.rabattGesamt);
  const [notizen, setNotizen] = useState(da.notizen ?? "");

  const save = () => {
    update.mutate(
      { bezeichnung, frequenz, status, steuersatz, rabattGesamt, notizen },
      {
        onSuccess: () => {
          toast.success("Dauerauftrag gespeichert");
          onClose();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dauerauftrag bearbeiten</DialogTitle>
          <DialogDescription>{da.nummer}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Bezeichnung</Label>
            <Input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Frequenz</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={frequenz}
                onChange={(e) => setFrequenz(e.target.value as DauerauftragFrequenz)}
              >
                <option value="monatlich">Monatlich</option>
                <option value="quartalsweise">Quartalsweise</option>
                <option value="halbjaehrlich">Halbjährlich</option>
                <option value="jaehrlich">Jährlich</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as Dauerauftrag["status"])}
              >
                <option value="aktiv">Aktiv</option>
                <option value="pausiert">Pausiert</option>
                <option value="beendet">Beendet</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Steuersatz (%)</Label>
              <Input
                type="number"
                value={steuersatz}
                onChange={(e) => setSteuersatz(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Rabatt gesamt (%)</Label>
              <Input
                type="number"
                value={rabattGesamt}
                onChange={(e) => setRabattGesamt(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notizen</Label>
            <Input value={notizen} onChange={(e) => setNotizen(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Positionen werden beim Bearbeiten der zugehörigen Rechnung gepflegt.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Abbrechen
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    aktiv: "bg-success/10 text-success border-success/20",
    pausiert: "bg-warning/10 text-warning border-warning/20",
    beendet: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
        map[status] ?? map.beendet
      }`}
    >
      {status}
    </span>
  );
}
