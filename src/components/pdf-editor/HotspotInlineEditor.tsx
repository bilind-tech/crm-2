// Inline-Mini-Editor, der per Popover/Sheet direkt am Hotspot geöffnet wird.
// Schreibt live in den Draft (über die übergebenen Setter aus useBelegEditor).
// Komplexere Felder bekommen am Ende einen "Erweitert bearbeiten"-Button, der
// das passende Tab im rechten Panel öffnet.

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Angebot, Rechnung, Position } from "@/lib/api/types";
import { metaForId } from "@/lib/pdf/fieldMap";
import type { RowAction } from "./PdfFieldOverlay";
import {
  defaultIntroAngebot,
  defaultIntroRechnung,
  defaultOutroAngebot,
  defaultOutroRechnung,
} from "@/lib/pdf/belegPdf";

type Draft = Angebot | Rechnung;

interface Props {
  fieldId: string;
  draft: Draft;
  kind: "angebot" | "rechnung";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (key: any, value: any) => void;
  onOpenAdvanced: () => void;
  onClose: () => void;
  /** Optionale Zeilen-Aktionen (für pos:-Hotspots). */
  rowActions?: RowAction;
}

export function HotspotInlineEditor({
  fieldId,
  draft,
  kind,
  set,
  onOpenAdvanced,
  onClose,
  rowActions,
}: Props) {
  const meta = metaForId(fieldId);
  const firstRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => firstRef.current?.focus());
  }, [fieldId]);

  const Header = (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-xs font-semibold text-foreground">{meta.label}</p>
      <button
        type="button"
        onClick={onOpenAdvanced}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
        Erweitert
      </button>
    </div>
  );

  // Positions-Zeile
  if (fieldId.startsWith("pos:")) {
    const posId = fieldId.slice(4);
    return (
      <PositionRowEditor
        posId={posId}
        draft={draft}
        set={set}
        firstRef={firstRef}
        rowActions={rowActions}
        onOpenAdvanced={onOpenAdvanced}
        onClose={onClose}
      />
    );
  }

  switch (fieldId) {
    case "titel":
      return (
        <div className="w-[320px]">
          {Header}
          <Input
            ref={firstRef as React.RefObject<HTMLInputElement>}
            value={draft.titel}
            onChange={(e) => set("titel", e.target.value)}
            placeholder="Titel"
            className="text-sm"
          />
          <FooterDone onClose={onClose} />
        </div>
      );
    case "intro":
      return (
        <div className="w-[360px]">
          {Header}
          <Textarea
            ref={firstRef as React.RefObject<HTMLTextAreaElement>}
            value={
              draft.optionen?.eigenesIntro ??
              draft.introText ??
              (kind === "angebot"
                ? defaultIntroAngebot(draft as Angebot)
                : defaultIntroRechnung(draft as Rechnung))
            }
            onChange={(e) => {
              const v = e.target.value;
              const opt = draft.optionen ?? {
                materialBereitgestellt: true,
                standardAnschreiben: true,
                wiederkehrend: false,
              };
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              set("optionen", { ...opt, eigenesIntro: v } as any);
            }}
            rows={5}
            className="resize-none text-sm"
            placeholder="Einleitungstext"
          />
          <FooterDone onClose={onClose} />
        </div>
      );
    case "outro":
      return (
        <div className="w-[360px]">
          {Header}
          <Textarea
            ref={firstRef as React.RefObject<HTMLTextAreaElement>}
            value={
              draft.optionen?.eigenesOutro ??
              draft.outroText ??
              (kind === "angebot"
                ? defaultOutroAngebot(draft as Angebot, {
                    materialBereitgestellt: draft.optionen?.materialBereitgestellt,
                  })
                : defaultOutroRechnung(draft as Rechnung, {
                    materialBereitgestellt: draft.optionen?.materialBereitgestellt,
                  }))
            }
            onChange={(e) => {
              const v = e.target.value;
              const opt = draft.optionen ?? {
                materialBereitgestellt: true,
                standardAnschreiben: true,
                wiederkehrend: false,
              };
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              set("optionen", { ...opt, eigenesOutro: v } as any);
            }}
            rows={5}
            className="resize-none text-sm"
            placeholder="Schlusstext"
          />
          <FooterDone onClose={onClose} />
        </div>
      );
    default:
      // Komplexe / strukturierte Bereiche: nur Hinweis + direkter Sprung ins Tab.
      return (
        <div className="w-[280px]">
          {Header}
          <p className="text-xs text-muted-foreground">
            Dieser Bereich wird im rechten Editor strukturiert bearbeitet.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={onClose}>
              Schließen
            </Button>
            <Button size="sm" className="rounded-full" onClick={onOpenAdvanced}>
              <Pencil className="mr-1 h-3 w-3" />
              Bearbeiten
            </Button>
          </div>
        </div>
      );
  }
}

function FooterDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-2 flex justify-end">
      <Button size="sm" variant="ghost" className="rounded-full" onClick={onClose}>
        Fertig
      </Button>
    </div>
  );
}

// ───── Positions-Zeilen-Editor (breite Reihe wie die PDF-Tabelle) ────────

function PositionRowEditor({
  posId,
  draft,
  set,
  firstRef,
  rowActions,
  onOpenAdvanced,
  onClose,
}: {
  posId: string;
  draft: Draft;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (key: any, value: any) => void;
  firstRef: React.MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  rowActions?: RowAction;
  onOpenAdvanced: () => void;
  onClose: () => void;
}) {
  const idx = draft.positionen.findIndex((p) => p.id === posId);
  const pos = idx >= 0 ? draft.positionen[idx] : undefined;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    [],
  );

  if (!pos) {
    return (
      <div className="w-[280px] p-1 text-xs text-muted-foreground">
        Position nicht gefunden.
      </div>
    );
  }

  const updatePos = (patch: Partial<Position>) => {
    const next = draft.positionen.slice();
    next[idx] = { ...pos, ...patch };
    set("positionen", next);
  };

  const summe =
    pos.modus === "pauschal"
      ? (pos.pauschalpreisNetto ?? 0)
      : (pos.menge ?? 0) * (pos.einzelpreisNetto ?? 0);
  const eur = (n: number) =>
    n.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const armDelete = () => {
    if (!rowActions) return;
    if (confirmDelete) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmDelete(false);
      rowActions.onDelete(posId);
      onClose();
      return;
    }
    setConfirmDelete(true);
    confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 2000);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (mod && e.key === "Enter") {
      e.preventDefault();
      onClose();
    } else if (mod && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      rowActions?.onDuplicate(posId);
    } else if (mod && e.key === "Backspace") {
      e.preventDefault();
      armDelete();
    } else if (e.key === "Enter" && !e.shiftKey && !mod) {
      // Enter in einem Input (nicht Textarea) → neue Zeile darunter
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT") {
        e.preventDefault();
        rowActions?.onInsertBelow(posId);
      }
    }
  };

  return (
    <div className="w-[560px]" onKeyDown={handleKey}>
      {/* Kopfzeile mit Label + Aktions-Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-foreground">Position #{idx + 1}</p>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {pos.modus ?? "einzel"}
          </span>
        </div>
        {rowActions && (
          <div className="flex items-center gap-0.5">
            <ActionIcon
              label="Nach oben"
              disabled={!rowActions.canMoveUp(posId)}
              onClick={() => rowActions.onMoveUp(posId)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </ActionIcon>
            <ActionIcon
              label="Nach unten"
              disabled={!rowActions.canMoveDown(posId)}
              onClick={() => rowActions.onMoveDown(posId)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </ActionIcon>
            <ActionIcon label="Duplizieren (Cmd/Ctrl+D)" onClick={() => rowActions.onDuplicate(posId)}>
              <Copy className="h-3.5 w-3.5" />
            </ActionIcon>
            <ActionIcon
              label="Zeile darunter einfügen"
              onClick={() => rowActions.onInsertBelow(posId)}
            >
              <Plus className="h-3.5 w-3.5" />
            </ActionIcon>
            <ActionIcon
              label={confirmDelete ? "Wirklich löschen?" : "Löschen (Cmd/Ctrl+Backspace)"}
              onClick={armDelete}
              destructive
            >
              {confirmDelete ? (
                <span className="text-[10px] font-semibold">Sicher?</span>
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </ActionIcon>
          </div>
        )}
      </div>

      {/* Spalten-Header analog PDF */}
      <div
        className="mb-1 grid gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"
        style={{
          gridTemplateColumns:
            pos.modus === "pauschal"
              ? "1fr 140px 120px"
              : pos.modus === "stunden"
                ? "1fr 80px 90px 110px"
                : "1fr 80px 70px 110px",
        }}
      >
        <span>Leistung</span>
        {pos.modus === "pauschal" ? (
          <>
            <span className="text-right">Pauschalpreis</span>
            <span className="text-right">Σ netto</span>
          </>
        ) : pos.modus === "stunden" ? (
          <>
            <span className="text-center">Stunden</span>
            <span className="text-right">€/h</span>
            <span className="text-right">Σ netto</span>
          </>
        ) : (
          <>
            <span className="text-center">Menge</span>
            <span className="text-center">Einheit</span>
            <span className="text-right">€</span>
          </>
        )}
      </div>

      {/* Eingabezeile */}
      <div
        className="grid items-start gap-2"
        style={{
          gridTemplateColumns:
            pos.modus === "pauschal"
              ? "1fr 140px 120px"
              : pos.modus === "stunden"
                ? "1fr 80px 90px 110px"
                : "1fr 80px 70px 110px",
        }}
      >
        <Textarea
          ref={firstRef as React.RefObject<HTMLTextAreaElement>}
          value={pos.beschreibung}
          onChange={(e) => updatePos({ beschreibung: e.target.value })}
          rows={3}
          placeholder="Beschreibung der Leistung"
          className="resize-none text-sm"
        />
        {pos.modus === "pauschal" ? (
          <>
            <Input
              type="number"
              step="0.01"
              value={pos.pauschalpreisNetto ?? 0}
              onChange={(e) => updatePos({ pauschalpreisNetto: Number(e.target.value) })}
              className="text-right text-sm"
            />
            <div className="flex h-9 items-center justify-end rounded-md border border-input bg-muted/40 px-2 text-sm font-medium tabular-nums">
              {eur(summe)}
            </div>
          </>
        ) : pos.modus === "stunden" ? (
          <>
            <Input
              type="number"
              step="0.25"
              value={pos.menge}
              onChange={(e) => updatePos({ menge: Number(e.target.value) })}
              className="text-center text-sm tabular-nums"
            />
            <Input
              type="number"
              step="0.01"
              value={pos.einzelpreisNetto}
              onChange={(e) => updatePos({ einzelpreisNetto: Number(e.target.value) })}
              className="text-right text-sm tabular-nums"
            />
            <div className="flex h-9 items-center justify-end rounded-md border border-input bg-muted/40 px-2 text-sm font-medium tabular-nums">
              {eur(summe)}
            </div>
          </>
        ) : (
          <>
            <Input
              type="number"
              step="0.01"
              value={pos.menge}
              onChange={(e) => updatePos({ menge: Number(e.target.value) })}
              className="text-center text-sm tabular-nums"
            />
            <Input
              value={pos.einheit}
              onChange={(e) => updatePos({ einheit: e.target.value as Position["einheit"] })}
              className="text-center text-sm"
            />
            <Input
              type="number"
              step="0.01"
              value={pos.einzelpreisNetto}
              onChange={(e) => updatePos({ einzelpreisNetto: Number(e.target.value) })}
              className="text-right text-sm tabular-nums"
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenAdvanced}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          Voll-Editor
        </button>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={onClose}>
          Fertig
        </Button>
      </div>
    </div>
  );
}

function ActionIcon({
  children,
  onClick,
  label,
  destructive,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 items-center justify-center gap-1 rounded-md px-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
