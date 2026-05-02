import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Angebot, Rechnung, BelegOptionen } from "@/lib/api/types";

interface Props {
  draft: Angebot | Rechnung;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setOption: (key: keyof BelegOptionen, value: any) => void;
}

export function TexteOptionenPanel({ draft, setOption }: Props) {
  const o = draft.optionen ?? {
    materialBereitgestellt: true,
    standardAnschreiben: true,
    wiederkehrend: false,
  };

  return (
    <div className="space-y-5">
      <div data-feld-id="intro" className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Einleitungstext (Intro)
        </Label>
        <Textarea
          rows={5}
          value={o.eigenesIntro ?? ""}
          onChange={(e) => setOption("eigenesIntro", e.target.value)}
          placeholder="Leer lassen für Standard-Anschreiben aus den Vorlagen."
        />
      </div>

      <div data-feld-id="outro" className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Schlusstext (Outro)
        </Label>
        <Textarea
          rows={5}
          value={o.eigenesOutro ?? ""}
          onChange={(e) => setOption("eigenesOutro", e.target.value)}
          placeholder="Leer lassen für Standard-Schluss."
        />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Optionen
        </p>
        <CheckRow
          checked={o.materialBereitgestellt}
          onChange={(v) => setOption("materialBereitgestellt", v)}
          label="Reinigungsmittel & Werkzeuge werden bereitgestellt"
        />
        <CheckRow
          checked={o.standardAnschreiben}
          onChange={(v) => setOption("standardAnschreiben", v)}
          label="Standard-Anschreiben verwenden"
        />
        <CheckRow
          checked={o.wiederkehrend}
          onChange={(v) => setOption("wiederkehrend", v)}
          label="Wiederkehrend / Dauerauftrag"
        />
      </div>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}
