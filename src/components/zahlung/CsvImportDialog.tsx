// Dialog: CSV-Datei mit Bank-Umsätzen importieren.
// Schritte: Datei wählen → Spalten-Mapping prüfen → Vorschau → Import.

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, Check, X, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEUR, formatDate } from "@/lib/format";
import {
  parseCsv,
  autoMapping,
  applyMapping,
  type SpaltenMapping,
} from "@/lib/zahlung/csv-import";
import { useImportZahlungseingaenge } from "@/hooks/useZahlungseingaenge";

export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [rohzeilen, setRohzeilen] = useState<{ raw: Record<string, string> }[]>([]);
  const [mapping, setMapping] = useState<Partial<SpaltenMapping>>({});
  const [dateiname, setDateiname] = useState<string>("");
  const importHook = useImportZahlungseingaenge();

  const reset = () => {
    setHeader([]);
    setRohzeilen([]);
    setMapping({});
    setDateiname("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.header.length === 0) {
        toast.error("CSV-Datei ist leer.");
        return;
      }
      setHeader(parsed.header);
      setRohzeilen(parsed.rows);
      setMapping(autoMapping(parsed.header));
      setDateiname(file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CSV konnte nicht gelesen werden");
    }
  };

  const vollstaendig =
    !!mapping.datum && !!mapping.betrag && !!mapping.zweck;

  const verarbeitet = useMemo(() => {
    if (!vollstaendig) return [];
    return applyMapping(rohzeilen, mapping as SpaltenMapping);
  }, [rohzeilen, mapping, vollstaendig]);

  const eingaenge = verarbeitet.filter((r) => !r.istAusgang && r.betrag > 0);
  const ausgaenge = verarbeitet.length - eingaenge.length;

  const importieren = () => {
    if (eingaenge.length === 0) {
      toast.error("Keine Eingänge im gewählten Bereich.");
      return;
    }
    importHook.mutate(
      eingaenge.map((e) => ({
        buchungsdatum: e.buchungsdatum,
        betrag: e.betrag,
        verwendungszweck: e.verwendungszweck,
        senderName: e.senderName,
        senderIban: e.senderIban,
      })),
      {
        onSuccess: (res) => {
          toast.success(`${res.anzahl} Zahlungseingänge importiert`);
          reset();
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Import fehlgeschlagen"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Bank-Umsätze importieren (CSV)</DialogTitle>
          <DialogDescription>
            Sparkasse, Volksbank, N26 und die meisten anderen Online-Banking-Exporte.
            Lastschriften / Ausgänge werden automatisch übersprungen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {/* Datei-Upload */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            {!dateiname ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center transition hover:bg-muted/40"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">CSV-Datei wählen</p>
                <p className="text-xs text-muted-foreground">
                  Unterstützte Trennzeichen: Semikolon, Komma, Tab
                </p>
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{dateiname}</p>
                    <p className="text-xs text-muted-foreground">
                      {rohzeilen.length} Zeilen erkannt
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Andere Datei
                </Button>
              </div>
            )}
          </div>

          {/* Mapping */}
          {header.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Spalten-Zuordnung
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <MappingFeld
                  label="Buchungsdatum *"
                  value={mapping.datum}
                  onChange={(v) => setMapping((m) => ({ ...m, datum: v }))}
                  header={header}
                />
                <MappingFeld
                  label="Betrag *"
                  value={mapping.betrag}
                  onChange={(v) => setMapping((m) => ({ ...m, betrag: v }))}
                  header={header}
                />
                <MappingFeld
                  label="Verwendungszweck *"
                  value={mapping.zweck}
                  onChange={(v) => setMapping((m) => ({ ...m, zweck: v }))}
                  header={header}
                />
                <MappingFeld
                  label="Sender / Auftraggeber"
                  value={mapping.sender}
                  onChange={(v) => setMapping((m) => ({ ...m, sender: v || undefined }))}
                  header={header}
                  optional
                />
                <MappingFeld
                  label="Sender-IBAN"
                  value={mapping.iban}
                  onChange={(v) => setMapping((m) => ({ ...m, iban: v || undefined }))}
                  header={header}
                  optional
                />
              </div>
            </div>
          )}

          {/* Vorschau */}
          {vollstaendig && verarbeitet.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Vorschau
                </Label>
                <span className="text-xs text-muted-foreground">
                  {eingaenge.length} Eingänge
                  {ausgaenge > 0 && ` · ${ausgaenge} Ausgänge übersprungen`}
                </span>
              </div>
              <div className="max-h-64 overflow-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Datum</th>
                      <th className="px-3 py-2 font-medium">Betrag</th>
                      <th className="px-3 py-2 font-medium">Zweck</th>
                      <th className="px-3 py-2 font-medium">Sender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {eingaenge.slice(0, 50).map((e, i) => (
                      <tr key={`${e.buchungsdatum}-${e.betrag}-${i}`}>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {formatDate(e.buchungsdatum)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-medium">
                          {formatEUR(e.betrag)}
                        </td>
                        <td className="max-w-xs truncate px-3 py-1.5 text-muted-foreground">
                          {e.verwendungszweck}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-1.5 text-muted-foreground">
                          {e.senderName ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {eingaenge.length > 50 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  … und {eingaenge.length - 50} weitere
                </p>
              )}
            </div>
          )}

          {header.length > 0 && !vollstaendig && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                Bitte mindestens Datum, Betrag und Verwendungszweck zuordnen.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            <X className="mr-1.5 h-4 w-4" />
            Abbrechen
          </Button>
          <Button
            onClick={importieren}
            disabled={!vollstaendig || eingaenge.length === 0 || importHook.isPending}
            className="rounded-full"
          >
            <Check className="mr-1.5 h-4 w-4" />
            {eingaenge.length > 0 ? `${eingaenge.length} importieren` : "Importieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MappingFeld({
  label,
  value,
  onChange,
  header,
  optional,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  header: string[];
  optional?: boolean;
}) {
  const NONE = "__none__";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Select
        value={value ?? (optional ? NONE : "")}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Spalte wählen…" />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={NONE}>— keine —</SelectItem>}
          {header.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
