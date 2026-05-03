// PDF-Hook mit React-Query-Cache.
//
// - Pro Beleg-ID gibt es genau EINE Query (`["pdf", art, id]`).
// - `staleTime: Infinity` → solange App offen, kein automatisches Nachladen.
// - Beim ersten Öffnen wird die PDF einmal gebaut/geladen, danach kommt sie
//   bei jedem Re-Mount sofort aus dem Cache (kein Loader-Flackern).
// - Editor-Save invalidiert die Query → einmaliger Reload mit neuer Version.
//
// Backend-Modus (Pi): Server liefert die PDF aus seinem Disk-Cache (ETag,
//   `X-Pdf-Cache: hit/miss`). Schreibt eine neue Datei, löscht atomar die alte
//   gleiche-ID-Datei.
// Mock-Modus (Lovable-Preview): pdfmake baut im Browser, Ergebnis liegt zusätzlich
//   in einer LRU-Map in `belegPdf.ts`.

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useKunde, useFirmendaten } from "@/hooks/useApi";
import { generateAngebotPdf, generateRechnungPdf } from "@/lib/pdf/belegPdf";
import { fetchBackendPdf } from "@/lib/pdf/backendPdf";
import type { Angebot, Rechnung, Kunde, Firmendaten } from "@/lib/api/types";

type Status = "idle" | "loading" | "ready" | "error";

const PDF_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} hat zu lange gedauert (>${Math.round(ms / 1000)}s).`)),
      ms,
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export const pdfQueryKey = (art: "angebot" | "rechnung", id: string) => ["pdf", art, id] as const;

interface PdfData {
  blob: Blob;
  fileName?: string;
}

async function buildAngebot(angebot: Angebot, kunde: Kunde, firma: Firmendaten): Promise<PdfData> {
  const backend = await fetchBackendPdf("angebot", angebot.id);
  if (backend) return { blob: backend.blob, fileName: backend.dateiname };
  const { blob } = await withTimeout(generateAngebotPdf(angebot, kunde, firma), PDF_TIMEOUT_MS, "PDF-Erstellung");
  return { blob };
}

async function buildRechnung(rechnung: Rechnung, kunde: Kunde, firma: Firmendaten): Promise<PdfData> {
  const backend = await fetchBackendPdf("rechnung", rechnung.id);
  if (backend) return { blob: backend.blob, fileName: backend.dateiname };
  const { blob } = await withTimeout(generateRechnungPdf(rechnung, kunde, firma), PDF_TIMEOUT_MS, "PDF-Erstellung");
  return { blob };
}

/** Erzeugt eine stabile Blob-URL und gibt sie frei, wenn sich der Blob ändert oder die Komponente unmountet. */
function useBlobUrl(blob: Blob | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastRef.current;
    lastRef.current = url;
    return () => {
      if (prev && prev !== url) URL.revokeObjectURL(prev);
    };
  }, [url]);
  // Final-Cleanup beim Unmount
  useEffect(() => {
    return () => {
      if (lastRef.current) {
        URL.revokeObjectURL(lastRef.current);
        lastRef.current = null;
      }
    };
  }, []);
  return url;
}

interface UsePdfResult {
  url: string | null;
  status: Status;
  error: string | null;
  fileName?: string;
}

export function useAngebotPdf(angebot?: Angebot): UsePdfResult {
  const { data: kunde } = useKunde(angebot?.kundeId ?? "");
  const { data: firma } = useFirmendaten();
  const enabled = !!angebot && !!kunde && !!firma;

  const query = useQuery({
    queryKey: angebot ? pdfQueryKey("angebot", angebot.id) : ["pdf", "angebot", "noop"],
    queryFn: () => buildAngebot(angebot!, kunde!, firma!),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const url = useBlobUrl(query.data?.blob);
  const status: Status = !enabled ? "idle"
    : query.isError ? "error"
    : query.data ? "ready"
    : "loading";

  return {
    url,
    status,
    error: query.error ? String((query.error as Error)?.message ?? query.error) : null,
    fileName: query.data?.fileName,
  };
}

export function useRechnungPdf(rechnung?: Rechnung): UsePdfResult {
  const { data: kunde } = useKunde(rechnung?.kundeId ?? "");
  const { data: firma } = useFirmendaten();
  const enabled = !!rechnung && !!kunde && !!firma;

  const query = useQuery({
    queryKey: rechnung ? pdfQueryKey("rechnung", rechnung.id) : ["pdf", "rechnung", "noop"],
    queryFn: () => buildRechnung(rechnung!, kunde!, firma!),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const url = useBlobUrl(query.data?.blob);
  const status: Status = !enabled ? "idle"
    : query.isError ? "error"
    : query.data ? "ready"
    : "loading";

  return {
    url,
    status,
    error: query.error ? String((query.error as Error)?.message ?? query.error) : null,
    fileName: query.data?.fileName,
  };
}

/** Helper: PDF-Cache für eine Beleg-ID invalidieren (Editor-Save, SSE, manuell). */
export function useInvalidateBelegPdf() {
  const qc = useQueryClient();
  return (art: "angebot" | "rechnung", id: string) => {
    qc.invalidateQueries({ queryKey: pdfQueryKey(art, id) });
  };
}
