import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useKunden, useObjekte, useCreateRechnung } from "@/hooks/useApi";
import { toast } from "sonner";
import { addDays, todayISO } from "@/lib/format";
import {
  PositionenEditor,
  emptyPosition,
  toApiPositionen,
  type PositionDraft,
} from "./PositionenEditor";
import { OptionenBlock, defaultOptionen, type OptionenState } from "./OptionenBlock";
import { AnsprechpartnerPicker } from "./AnsprechpartnerPicker";
import { Repeat } from "lucide-react";

interface Props {
  onClose: () => void;
  defaultKundeId?: string;
  defaultObjektId?: string;
}

export function RechnungForm({ onClose, defaultKundeId, defaultObjektId }: Props) {
  const navigate = useNavigate();
  const { data: kunden = [] } = useKunden();
  const { data: objekteAlle = [] } = useObjekte();
  const create = useCreateRechnung();

  const [kundeId, setKundeId] = useState(defaultKundeId ?? "");
  const [objektId, setObjektId] = useState(defaultObjektId ?? "");
  const [titel, setTitel] = useState("");
  const [steuersatz, setSteuersatz] = useState(19);
  const [rabattGesamt, setRabattGesamt] = useState(0);
  const [rechnungsdatum, setRechnungsdatum] = useState(todayISO());
  const [frist, setFrist] = useState(14);
  const [faellig, setFaellig] = useState(addDays(todayISO(), 14));
  const [positionen, setPositionen] = useState<PositionDraft[]>([emptyPosition(19)]);
  const [optionen, setOptionen] = useState<OptionenState>(defaultOptionen);
  const [ansprechpartnerId, setAnsprechpartnerId] = useState<string | undefined>();

  const objekteVonKunde = useMemo(
    () => objekteAlle.filter((o) => o.kundeId === kundeId),
    [objekteAlle, kundeId]
  );

  function setFristTage(tage: number) {
    setFrist(tage);
    setFaellig(addDays(rechnungsdatum, tage));
  }
  function setRechnungsdatumAndFrist(d: string) {
    setRechnungsdatum(d);
    setFaellig(addDays(d, frist));
  }

  async function submit() {
    if (!kundeId) return toast.error("Bitte Kunde wählen");
    if (!titel.trim()) return toast.error("Titel ist erforderlich");
    if (positionen.length === 0) return toast.error("Mindestens eine Position erforderlich");

    const r = await create.mutateAsync({
      kundeId,
      objektId: objektId || undefined,
      ansprechpartnerId: ansprechpartnerId || undefined,
      titel,
      positionen: toApiPositionen(positionen),
      rabattGesamt,
      steuersatz,
      rechnungsdatum,
      faelligkeitsdatum: faellig,
      status: "entwurf",
      introText: optionen.eigenesIntroAktiv ? optionen.eigenesIntro : undefined,
      outroText: optionen.eigenesOutroAktiv ? optionen.eigenesOutro : undefined,
      optionen: {
        materialBereitgestellt: optionen.materialBereitgestellt,
        standardAnschreiben: optionen.standardAnschreiben,
        eigenesIntro: optionen.eigenesIntroAktiv ? optionen.eigenesIntro : undefined,
        eigenesOutro: optionen.eigenesOutroAktiv ? optionen.eigenesOutro : undefined,
        wiederkehrend: optionen.wiederkehrend,
      },
    });
    toast.success("Rechnung angelegt", { description: `${r.nummer} • erfolgreich gespeichert.` });
    onClose();
    navigate({ to: "/rechnungen/$id", params: { id: r.id } });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kunde *">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={kundeId}
            onChange={(e) => {
              setKundeId(e.target.value);
              setObjektId("");
            }}
          >
            <option value="">Kunde wählen…</option>
            {kunden.map((k) => (
              <option key={k.id} value={k.id}>
                {k.firmenname || `${k.vorname ?? ""} ${k.nachname ?? ""}`.trim()} · {k.nummer}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Objekt (optional)">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            value={objektId}
            disabled={!kundeId}
            onChange={(e) => setObjektId(e.target.value)}
          >
            <option value="">— kein Objekt —</option>
            {objekteVonKunde.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Titel *">
        <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Reinigung März 2026" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Rechnungsdatum">
          <Input type="date" value={rechnungsdatum} onChange={(e) => setRechnungsdatumAndFrist(e.target.value)} />
        </Field>
        <Field label="Zahlungsfrist (Tage)">
          <Input type="number" value={frist} onChange={(e) => setFristTage(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Fällig am">
          <Input type="date" value={faellig} onChange={(e) => setFaellig(e.target.value)} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Leistungen & Preise
        </p>
        <PositionenEditor positionen={positionen} onChange={setPositionen} defaultSteuersatz={steuersatz} />
      </div>

      <OptionenBlock value={optionen} onChange={setOptionen} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="MwSt-Satz (%)">
          <Input type="number" value={steuersatz} onChange={(e) => setSteuersatz(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Gesamtrabatt (%)">
          <Input type="number" value={rabattGesamt} onChange={(e) => setRabattGesamt(Number(e.target.value) || 0)} />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button disabled={create.isPending} onClick={submit} className="rounded-md px-6">
          {create.isPending ? "Speichere…" : "Rechnung anlegen"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
