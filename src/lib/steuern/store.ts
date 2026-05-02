// LocalStorage-Store für Steuer-Einstellungen + manuelle Steuerposten + bezahlt-Markierungen.
// Wird später durch Pi-Backend (SQLite) ersetzt.

import { useEffect, useState, useCallback } from "react";
import type { SteuerEinstellungen, SteuerPosten } from "./types";
import { STEUER_DEFAULTS } from "./types";

const SETTINGS_KEY = "mcc_steuer_einstellungen_v1";
const POSTEN_KEY = "mcc_steuer_posten_v1";
/** Map<autoPostenId, { bezahltAm, tatsaechlicherBetrag? }> für automatische Posten. */
const BEZAHLT_KEY = "mcc_steuer_bezahlt_v1";

export interface BezahltMarkierung {
  bezahltAm: string;
  tatsaechlicherBetrag?: number;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ---------- Einstellungen ----------

export function useSteuerEinstellungen() {
  const [data, setData] = useState<SteuerEinstellungen>(() =>
    readJson(SETTINGS_KEY, STEUER_DEFAULTS),
  );

  const update = useCallback((patch: Partial<SteuerEinstellungen>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      writeJson(SETTINGS_KEY, next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setData(STEUER_DEFAULTS);
    writeJson(SETTINGS_KEY, STEUER_DEFAULTS);
  }, []);

  return { data, update, reset };
}

export function getSteuerEinstellungen(): SteuerEinstellungen {
  return readJson(SETTINGS_KEY, STEUER_DEFAULTS);
}

// ---------- Manuelle Posten ----------

export function useManuellePosten() {
  const [posten, setPosten] = useState<SteuerPosten[]>(() => readJson<SteuerPosten[]>(POSTEN_KEY, []));

  const add = useCallback((neu: Omit<SteuerPosten, "id" | "erstelltAm" | "automatisch">) => {
    const p: SteuerPosten = {
      ...neu,
      id: `man-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      automatisch: false,
      erstelltAm: new Date().toISOString(),
    };
    setPosten((prev) => {
      const next = [...prev, p];
      writeJson(POSTEN_KEY, next);
      return next;
    });
    return p;
  }, []);

  const update = useCallback((id: string, patch: Partial<SteuerPosten>) => {
    setPosten((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      writeJson(POSTEN_KEY, next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPosten((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeJson(POSTEN_KEY, next);
      return next;
    });
  }, []);

  return { posten, add, update, remove };
}

// ---------- Bezahlt-Markierungen für automatische Posten ----------

export function useBezahltMarkierungen() {
  const [map, setMap] = useState<Record<string, BezahltMarkierung>>(() =>
    readJson<Record<string, BezahltMarkierung>>(BEZAHLT_KEY, {}),
  );

  const setBezahlt = useCallback((postenId: string, eintrag: BezahltMarkierung) => {
    setMap((prev) => {
      const next = { ...prev, [postenId]: eintrag };
      writeJson(BEZAHLT_KEY, next);
      return next;
    });
  }, []);

  const removeBezahlt = useCallback((postenId: string) => {
    setMap((prev) => {
      const next = { ...prev };
      delete next[postenId];
      writeJson(BEZAHLT_KEY, next);
      return next;
    });
  }, []);

  return { map, setBezahlt, removeBezahlt };
}

/** Cross-Tab-Sync */
export function useStorageSync(callback: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY || e.key === POSTEN_KEY || e.key === BEZAHLT_KEY) {
        callback();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [callback]);
}
