import { useEffect, useState } from "react";
import { useKunde, useFirmendaten } from "@/hooks/useApi";
import { generateAngebotPdf, generateRechnungPdf } from "@/lib/pdf/belegPdf";
import type { Angebot, Rechnung } from "@/lib/api/types";

type Status = "idle" | "loading" | "ready" | "error";

export function useAngebotPdf(angebot?: Angebot) {
  const { data: kunde } = useKunde(angebot?.kundeId ?? "");
  const { data: firma } = useFirmendaten();
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!angebot || !kunde || !firma) return;
    let blobUrl: string | null = null;
    let cancelled = false;
    setStatus("loading");
    generateAngebotPdf(angebot, kunde, firma)
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(String(e?.message ?? e));
        setStatus("error");
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [angebot, kunde, firma]);

  return { url, status, error };
}

export function useRechnungPdf(rechnung?: Rechnung) {
  const { data: kunde } = useKunde(rechnung?.kundeId ?? "");
  const { data: firma } = useFirmendaten();
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rechnung || !kunde || !firma) return;
    let blobUrl: string | null = null;
    let cancelled = false;
    setStatus("loading");
    generateRechnungPdf(rechnung, kunde, firma)
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError(String(e?.message ?? e));
        setStatus("error");
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [rechnung, kunde, firma]);

  return { url, status, error };
}
