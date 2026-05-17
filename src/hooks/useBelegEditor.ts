// Lokaler Draft-Editor für Angebote/Rechnungen.
// - Hält den Draft im State (Quelle der Wahrheit für Live-Preview).
// - Autosave 1.5s nach letzter Änderung via useUpdateAngebot/useUpdateRechnung.
// - Stellt focusField(id) bereit: scrollt das Element mit data-feld-id im
//   EditorPanel ins Sichtfeld + kurzer Highlight + fokussiert das erste Input.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useUpdateAngebot, useUpdateRechnung } from "@/hooks/useApi";
import { useInvalidateBelegPdf } from "@/hooks/useBelegPdf";
import type { Angebot, Position, PositionModus, Rechnung } from "@/lib/api/types";

type BelegKind = "angebot" | "rechnung";

const VOLATILE_KEYS = new Set(["aktualisiertAm", "updatedAt", "erstelltAm", "createdAt"]);

function stableStringify<T>(obj: T): string {
  return JSON.stringify(obj, (key, value) => (VOLATILE_KEYS.has(key) ? undefined : value));
}

export function useBelegEditor<T extends Angebot | Rechnung>(kind: BelegKind, beleg: T) {
  const [draft, setDraft] = useState<T>(beleg);
  const lastSavedRef = useRef<string>(stableStringify(beleg));
  const draftRef = useRef<T>(beleg);
  draftRef.current = draft;

  // Server-Echos nur dann in den Draft spiegeln, wenn der lokale Draft nicht
  // dirty ist UND sich semantisch (ohne Timestamps) etwas geändert hat.
  useEffect(() => {
    const incoming = stableStringify(beleg);
    if (incoming === lastSavedRef.current) return;
    const currentDraft = stableStringify(draftRef.current);
    if (incoming === currentDraft) {
      lastSavedRef.current = incoming;
      return;
    }
    if (currentDraft !== lastSavedRef.current) return; // Draft dirty → User-Eingaben behalten
    setDraft(beleg);
    lastSavedRef.current = incoming;
  }, [beleg]);

  const isDirty = useMemo(() => stableStringify(draft) !== lastSavedRef.current, [draft]);

  const updateAngebot = useUpdateAngebot(kind === "angebot" ? draft.id : "");
  const updateRechnung = useUpdateRechnung(kind === "rechnung" ? draft.id : "");
  const invalidatePdf = useInvalidateBelegPdf();

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Positions-Helfer ────────────────────────────────────────────────────
  const makeEmptyPosition = (modus: PositionModus = "einzel"): Position => ({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    beschreibung: "",
    menge: modus === "pauschal" ? 1 : 1,
    einheit: modus === "stunden" ? "h" : modus === "pauschal" ? "pauschal" : "stk",
    einzelpreisNetto: 0,
    steuersatz: 19,
    rabatt: 0,
    modus,
    pauschalpreisNetto: modus === "pauschal" ? 0 : undefined,
  });

  const mutatePositions = useCallback(
    (fn: (list: Position[]) => Position[]) => {
      setDraft((prev) => ({ ...prev, positionen: fn(prev.positionen.slice()) }));
    },
    [],
  );

  const updatePosition = useCallback(
    (id: string, patch: Partial<Position>) => {
      mutatePositions((list) => {
        const idx = list.findIndex((p) => p.id === id);
        if (idx < 0) return list;
        list[idx] = { ...list[idx], ...patch };
        return list;
      });
    },
    [mutatePositions],
  );

  const movePosition = useCallback(
    (id: string, dir: "up" | "down") => {
      mutatePositions((list) => {
        const idx = list.findIndex((p) => p.id === id);
        if (idx < 0) return list;
        const j = dir === "up" ? idx - 1 : idx + 1;
        if (j < 0 || j >= list.length) return list;
        [list[idx], list[j]] = [list[j], list[idx]];
        return list;
      });
    },
    [mutatePositions],
  );

  const insertPositionAfter = useCallback(
    (id: string, modus?: PositionModus): string => {
      const newPos = makeEmptyPosition(modus);
      mutatePositions((list) => {
        const idx = list.findIndex((p) => p.id === id);
        if (idx < 0) {
          list.push(newPos);
          return list;
        }
        list.splice(idx + 1, 0, newPos);
        return list;
      });
      return newPos.id;
    },
    [mutatePositions],
  );

  const duplicatePosition = useCallback(
    (id: string): string | null => {
      let newId: string | null = null;
      mutatePositions((list) => {
        const idx = list.findIndex((p) => p.id === id);
        if (idx < 0) return list;
        const copy: Position = {
          ...list[idx],
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        };
        newId = copy.id;
        list.splice(idx + 1, 0, copy);
        return list;
      });
      return newId;
    },
    [mutatePositions],
  );

  const removePosition = useCallback(
    (id: string) => {
      mutatePositions((list) => list.filter((p) => p.id !== id));
    },
    [mutatePositions],
  );

  const addEmptyPosition = useCallback(
    (modus?: PositionModus): string => {
      const newPos = makeEmptyPosition(modus);
      mutatePositions((list) => {
        list.push(newPos);
        return list;
      });
      return newPos.id;
    },
    [mutatePositions],
  );

  const setOption = useCallback(
    <K extends keyof NonNullable<T["optionen"]>>(key: K, value: NonNullable<T["optionen"]>[K]) => {
      setDraft((prev) => ({
        ...prev,
        optionen: {
          ...(prev.optionen ?? {
            materialBereitgestellt: true,
            standardAnschreiben: true,
            wiederkehrend: false,
          }),
          [key]: value,
        } as T["optionen"],
      }));
    },
    [],
  );

  const save = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isDirty) return;
      try {
        const payload = { ...draft } as Partial<T>;
        if (kind === "angebot") {
          await updateAngebot.mutateAsync(payload as Partial<Angebot>);
        } else {
          await updateRechnung.mutateAsync(payload as Partial<Rechnung>);
        }
        lastSavedRef.current = stableStringify(draft);
        // PDF-Cache (React Query) verwerfen → Detailseite holt neue Version.
        invalidatePdf(kind, draft.id);
        if (!opts?.silent) toast.success("Gespeichert", { duration: 1500 });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      }
    },
    [draft, isDirty, kind, updateAngebot, updateRechnung, invalidatePdf],
  );

  // Autosave nach 1.5s ohne Änderung — silent (kein Toast).
  useEffect(() => {
    if (!isDirty) return;
    const t = setTimeout(() => {
      void save({ silent: true });
    }, 1500);
    return () => clearTimeout(t);
  }, [draft, isDirty, save]);

  const discard = useCallback(() => {
    setDraft(beleg);
    lastSavedRef.current = JSON.stringify(beleg);
  }, [beleg]);

  // Click-to-edit: scrollt das Panel zum Feld + Highlight + Fokus.
  const focusField = useCallback((fieldId: string) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-feld-id="${CSS.escape(fieldId)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "rounded-md");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "rounded-md");
      }, 1500);
      const input = el.querySelector<HTMLElement>("input,textarea,select,button");
      input?.focus();
    });
  }, []);

  return {
    draft,
    set,
    setOption,
    setDraft,
    isDirty,
    save,
    discard,
    focusField,
    saving: updateAngebot.isPending || updateRechnung.isPending,
    // Positions-Aktionen
    updatePosition,
    movePosition,
    insertPositionAfter,
    duplicatePosition,
    removePosition,
    addEmptyPosition,
  };
}
