import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface OptionenState {
  materialBereitgestellt: boolean;
  standardAnschreiben: boolean;
  eigenesIntroAktiv: boolean;
  eigenesIntro: string;
  eigenesOutroAktiv: boolean;
  eigenesOutro: string;
  wiederkehrend: boolean;
}

export const defaultOptionen: OptionenState = {
  materialBereitgestellt: true,
  standardAnschreiben: true,
  eigenesIntroAktiv: false,
  eigenesIntro: "",
  eigenesOutroAktiv: false,
  eigenesOutro: "",
  wiederkehrend: false,
};

interface Props {
  value: OptionenState;
  onChange: (next: OptionenState) => void;
}

export function OptionenBlock({ value, onChange }: Props) {
  const set = <K extends keyof OptionenState>(k: K, v: OptionenState[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Optionen</p>

      <Row
        checked={value.materialBereitgestellt}
        onChange={(v) => set("materialBereitgestellt", v)}
        label="Wir stellen Reinigungsmittel & Werkzeuge bereit"
        hint='Fügt den Standardsatz "… werden Reinigungswerkzeuge und Reinigungsmittel von uns zur Verfügung gestellt." ins PDF ein.'
      />
      <Row
        checked={value.standardAnschreiben}
        onChange={(v) => set("standardAnschreiben", v)}
        label="Standard-Anschreiben verwenden"
      />

      <Row
        checked={value.eigenesIntroAktiv}
        onChange={(v) => set("eigenesIntroAktiv", v)}
        label="Eigener Einleitungstext"
      />
      {value.eigenesIntroAktiv && (
        <div className="pl-7">
          <Textarea
            rows={3}
            value={value.eigenesIntro}
            onChange={(e) => set("eigenesIntro", e.target.value)}
            placeholder="Sehr geehrte Damen und Herren, …"
          />
        </div>
      )}

      <Row
        checked={value.eigenesOutroAktiv}
        onChange={(v) => set("eigenesOutroAktiv", v)}
        label="Eigener Schlusstext"
      />
      {value.eigenesOutroAktiv && (
        <div className="pl-7">
          <Textarea
            rows={3}
            value={value.eigenesOutro}
            onChange={(e) => set("eigenesOutro", e.target.value)}
            placeholder="Wir freuen uns auf Ihre Rückmeldung. …"
          />
        </div>
      )}

      <Row
        checked={value.wiederkehrend}
        onChange={(v) => set("wiederkehrend", v)}
        label="Als Dauerauftrag / wiederkehrend kennzeichnen"
      />
    </div>
  );
}

function Row({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <div className="min-w-0">
        <Label
          className="cursor-pointer text-sm font-medium"
          onClick={() => onChange(!checked)}
        >
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
