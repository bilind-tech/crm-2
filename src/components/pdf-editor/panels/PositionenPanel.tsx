import {
  PositionenEditor,
  fromApiPosition,
  toApiPositionen,
  type PositionDraft,
} from "@/components/forms/PositionenEditor";
import type { Angebot, Rechnung } from "@/lib/api/types";

interface Props {
  draft: Angebot | Rechnung;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (key: any, value: any) => void;
}

export function PositionenPanel({ draft, set }: Props) {
  const positionen: PositionDraft[] = draft.positionen.map(fromApiPosition);

  return (
    <div data-feld-id="positionen" className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Positionen
      </p>
      <PositionenEditor
        positionen={positionen}
        onChange={(next) => set("positionen", toApiPositionen(next))}
        defaultSteuersatz={draft.steuersatz}
      />
    </div>
  );
}
