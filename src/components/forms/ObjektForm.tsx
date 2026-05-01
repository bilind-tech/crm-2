import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKunden, useCreateObjekt } from "@/hooks/useApi";
import { toast } from "sonner";
import type { Reinigungsfrequenz, ObjektTyp } from "@/lib/api/types";

interface Props {
  onClose: () => void;
  defaultKundeId?: string;
}

export function ObjektForm({ onClose, defaultKundeId }: Props) {
  const { data: kunden = [] } = useKunden();
  const create = useCreateObjekt();
  const navigate = useNavigate();
  const [kundeId, setKundeId] = useState(defaultKundeId ?? "");
  const [name, setName] = useState("");
  const [typ, setTyp] = useState<ObjektTyp>("buero");
  const [strasse, setStrasse] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [qmZuReinigen, setQm] = useState<number | "">("");
  const [frequenz, setFrequenz] = useState<Reinigungsfrequenz>("woechentlich");
  const [zugang, setZugang] = useState("");

  async function submit() {
    if (!kundeId) {
      toast.error("Bitte Kunde wählen");
      return;
    }
    if (!name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    const o = await create.mutateAsync({
      kundeId,
      name,
      typ,
      strasse,
      plz,
      ort,
      qmZuReinigen: typeof qmZuReinigen === "number" ? qmZuReinigen : undefined,
      frequenz,
      reinigungstage: [],
      zugangsinfo: zugang || undefined,
      status: "aktiv",
    });
    toast.success("Objekt angelegt", { description: `${o.nummer} • erfolgreich gespeichert.` });
    onClose();
    navigate({ to: "/objekte/$id", params: { id: o.id } });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kunde *">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={kundeId}
            onChange={(e) => setKundeId(e.target.value)}
          >
            <option value="">Kunde wählen…</option>
            {kunden.map((k) => (
              <option key={k.id} value={k.id}>
                {k.firmenname || `${k.vorname ?? ""} ${k.nachname ?? ""}`.trim()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Objekttyp">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={typ}
            onChange={(e) => setTyp(e.target.value as ObjektTyp)}
          >
            <option value="buero">Büro</option>
            <option value="wohnen">Wohnen</option>
            <option value="gewerbe">Gewerbe</option>
            <option value="industrie">Industrie</option>
            <option value="medizin">Medizin</option>
            <option value="bildung">Bildung</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </Field>
      </div>
      <Field label="Bezeichnung *">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Bürogebäude Hauptsitz" />
      </Field>
      <Field label="Straße & Hausnummer"><Input value={strasse} onChange={(e) => setStrasse(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="PLZ"><Input value={plz} onChange={(e) => setPlz(e.target.value)} /></Field>
        <Field label="Ort" className="sm:col-span-2"><Input value={ort} onChange={(e) => setOrt(e.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="m² zu reinigen">
          <Input
            type="number"
            value={qmZuReinigen}
            onChange={(e) => setQm(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </Field>
        <Field label="Reinigungsfrequenz">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={frequenz}
            onChange={(e) => setFrequenz(e.target.value as Reinigungsfrequenz)}
          >
            <option value="taeglich">Täglich</option>
            <option value="woechentlich">Wöchentlich</option>
            <option value="14taegig">14-tägig</option>
            <option value="monatlich">Monatlich</option>
            <option value="quartalsweise">Quartalsweise</option>
            <option value="auf_abruf">Auf Abruf</option>
          </select>
        </Field>
      </div>
      <Field label="Zugang / Hinweise">
        <Textarea rows={3} value={zugang} onChange={(e) => setZugang(e.target.value)} placeholder="Schlüssel beim Pförtner, Code …" />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button disabled={create.isPending} onClick={submit} className="rounded-md px-6">
          {create.isPending ? "Speichere…" : "Objekt anlegen"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
