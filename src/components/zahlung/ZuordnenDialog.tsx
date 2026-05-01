// Dialog: Zahlungseingang einer/mehreren Rechnungen zuordnen.
// Zeigt Top-5 Vorschläge mit Score, erlaubt manuelles Überschreiben des Betrags
// und unterstützt Sammelüberweisungen (mehrere Zeilen).

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Search, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatEUR, formatDate } from "@/lib/format";
import { summenRechnung } from "@/lib/mock/backend";
import { scoreFarbe } from "@/lib/zahlung/match";
import { useMatchVorschlaege } from "@/hooks/useMatchVorschlaege";
import { useZuordnenZahlungseingang } from "@/hooks/useZahlungseingaenge";
import type { Zahlungseingang, Rechnung } from "@/lib/api/types";

interface Zeile {
  rechnungId: string;
  betrag: number;
  score?: number;
}

export function ZuordnenDialog({
  eingang,
  open,
  onOpenChange,
}: {
  eingang: Zahlungseingang | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { vorschlaege, offene, kunden } = useMatchVorschlaege(eingang, 5);
  const zuordnen = useZuordnenZahlungseingang();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [suche, setSuche] = useState("");

  // Reset bei Öffnen
  useEffect(() => {
    if (!open || !eingang) {
      setZeilen([]);
      setSuche("");
      return;
    }
    // Top-Vorschlag mit vollem Betrag vorbelegen
    const top = vorschlaege[0];
    if (top) {
      const r = offene.find((x) => x.id === top.rechnungId);
      if (r) {
        const s = summenRechnung(r.positionen, r.rabattGesamt);
        const bezahlt = r.zahlungen.reduce((a, z) => a + z.betrag, 0);
        const offenRest = Math.max(0, s.brutto - bezahlt);
        const vorschlag = Math.min(eingang.betrag, offenRest);
        setZeilen([{ rechnungId: top.rechnungId, betrag: vorschlag, score: top.score }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eingang?.id]);

  const summeZuordnung = zeilen.reduce((a, z) => a + (z.betrag || 0), 0);
  const rest = (eingang?.betrag ?? 0) - summeZuordnung;
  const ueberbucht = rest < -0.005;

  const offeneRest = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of offene) {
      const s = summenRechnung(r.positionen, r.rabattGesamt);
      const bezahlt = r.zahlungen.reduce((a, z) => a + z.betrag, 0);
      map.set(r.id, Math.max(0, s.brutto - bezahlt));
    }
    return map;
  }, [offene]);

  const trefferSuche = useMemo(() => {
    if (!suche.trim()) return [] as Rechnung[];
    const q = suche.toLowerCase().trim();
    return offene
      .filter((r) => {
        if (zeilen.some((z) => z.rechnungId === r.id)) return false;
        const k = kunden.find((kk) => kk.id === r.kundeId);
        const kundeName = k
          ? [k.firmenname, k.nachname, k.vorname].filter(Boolean).join(" ")
          : "";
        return (
          r.nummer.toLowerCase().includes(q) ||
          r.titel.toLowerCase().includes(q) ||
          kundeName.toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [suche, offene, kunden, zeilen]);

  const fuegeRechnungHinzu = (r: Rechnung, score?: number) => {
    if (zeilen.some((z) => z.rechnungId === r.id)) return;
    const offenRest = offeneRest.get(r.id) ?? 0;
    const verfuegbar = Math.max(0, (eingang?.betrag ?? 0) - summeZuordnung);
    const betrag = Math.min(offenRest, verfuegbar);
    setZeilen((zs) => [...zs, { rechnungId: r.id, betrag, score }]);
    setSuche("");
  };

  const speichern = () => {
    if (!eingang) return;
    const zu = zeilen.filter((z) => z.betrag > 0.005);
    if (zu.length === 0) {
      toast.error("Bitte mindestens eine Zuordnung mit Betrag eingeben.");
      return;
    }
    zuordnen.mutate(
      { id: eingang.id, zuordnungen: zu },
      {
        onSuccess: () => {
          toast.success(
            zu.length === 1 ? "Zahlung zugeordnet" : `${zu.length} Zuordnungen gespeichert`,
          );
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
      },
    );
  };

  if (!eingang) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Zahlungseingang zuordnen</DialogTitle>
          <DialogDescription>
            {formatDate(eingang.buchungsdatum)} · {formatEUR(eingang.betrag)}
            {eingang.senderName ? ` · ${eingang.senderName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {/* Verwendungszweck */}
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Verwendungszweck
            </p>
            <p className="mt-1 break-words text-sm">{eingang.verwendungszweck || "—"}</p>
          </div>

          {/* Vorschläge */}
          {vorschlaege.length > 0 && (
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Vorschläge
              </Label>
              <div className="mt-2 space-y-2">
                {vorschlaege.map((v) => {
                  const r = offene.find((x) => x.id === v.rechnungId);
                  if (!r) return null;
                  const k = kunden.find((kk) => kk.id === r.kundeId);
                  const ausgewaehlt = zeilen.some((z) => z.rechnungId === r.id);
                  const kundeName = k
                    ? k.firmenname || `${k.vorname ?? ""} ${k.nachname ?? ""}`.trim()
                    : "—";
                  return (
                    <button
                      key={v.rechnungId}
                      type="button"
                      onClick={() => !ausgewaehlt && fuegeRechnungHinzu(r, v.score)}
                      disabled={ausgewaehlt}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
                        ausgewaehlt
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{r.nummer}</span>
                          <ScoreBadge score={v.score} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {kundeName} · offen {formatEUR(offeneRest.get(r.id) ?? 0)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {v.begruendungen.join(" · ")}
                        </p>
                      </div>
                      {ausgewaehlt ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manuelle Suche */}
          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Weitere Rechnung suchen
            </Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Nummer, Titel oder Kunde…"
                className="pl-9"
              />
            </div>
            {trefferSuche.length > 0 && (
              <div className="mt-2 space-y-1 rounded-xl border border-border bg-muted/20 p-1">
                {trefferSuche.map((r) => {
                  const k = kunden.find((kk) => kk.id === r.kundeId);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => fuegeRechnungHinzu(r)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-card"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.nummer} · {r.titel}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {k?.firmenname || `${k?.vorname ?? ""} ${k?.nachname ?? ""}`.trim()} · offen {formatEUR(offeneRest.get(r.id) ?? 0)}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Zugeordnete Zeilen */}
          {zeilen.length > 0 && (
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Zuordnung
              </Label>
              <div className="mt-2 space-y-2">
                {zeilen.map((z, idx) => {
                  const r = offene.find((x) => x.id === z.rechnungId);
                  if (!r) return null;
                  const offenRest = offeneRest.get(r.id) ?? 0;
                  return (
                    <div
                      key={z.rechnungId}
                      className="flex items-center gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.nummer} · {r.titel}</p>
                        <p className="text-[11px] text-muted-foreground">
                          offen {formatEUR(offenRest)}
                        </p>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          value={z.betrag}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setZeilen((zs) =>
                              zs.map((x, i) => (i === idx ? { ...x, betrag: v } : x)),
                            );
                          }}
                          className="h-9 text-right text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setZeilen((zs) => zs.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bilanz */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Eingang</span>
              <span className="font-medium">{formatEUR(eingang.betrag)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Zugeordnet</span>
              <span className="font-medium">{formatEUR(summeZuordnung)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
              <span className="text-muted-foreground">Rest</span>
              <span
                className={cn(
                  "font-semibold",
                  ueberbucht
                    ? "text-destructive"
                    : Math.abs(rest) < 0.005
                      ? "text-success"
                      : "text-warning",
                )}
              >
                {formatEUR(rest)}
              </span>
            </div>
            {ueberbucht && (
              <p className="mt-2 text-xs text-destructive">
                Summe der Zuordnungen übersteigt den Eingang.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            <X className="mr-1.5 h-4 w-4" />
            Abbrechen
          </Button>
          <Button
            onClick={speichern}
            disabled={ueberbucht || summeZuordnung < 0.01 || zuordnen.isPending}
            className="rounded-full"
          >
            <Check className="mr-1.5 h-4 w-4" />
            Zuordnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const farbe = scoreFarbe(score);
  const cls =
    farbe === "green"
      ? "bg-success/15 text-success"
      : farbe === "yellow"
        ? "bg-warning/15 text-warning"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {score}
    </span>
  );
}
