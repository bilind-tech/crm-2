// Lädt PDFs vom Pi-Backend (Step 5).
// Liefert null, wenn kein explizites Backend konfiguriert ist (Demo/Mock-Modus)
// oder das Backend offline/nicht antwortet — Caller fällt dann auf Browser-Generator zurück.

import { getBackendUrl, isBackendUrlExplicit } from "@/lib/api/backendUrl";

export type BelegArt = "angebot" | "rechnung";

export interface BackendPdfResult {
  blob: Blob;
  dateiname: string;
  hash: string;
  fromCache: boolean;
}

function parseDateiname(headers: Headers, fallback: string): string {
  const cd = headers.get("content-disposition") ?? "";
  // filename*=UTF-8''... oder filename="..."
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* noop */
    }
  }
  const plain = /filename="?([^"]+)"?/i.exec(cd);
  return plain ? plain[1] : fallback;
}

export async function fetchBackendPdf(
  art: BelegArt,
  id: string,
  signal?: AbortSignal,
): Promise<BackendPdfResult | null> {
  if (!isBackendUrlExplicit()) return null;
  const base = getBackendUrl();
  const route = art === "angebot" ? "angebote" : "rechnungen";
  let res: Response;
  try {
    res = await fetch(`${base}/${route}/${encodeURIComponent(id)}/pdf`, {
      credentials: "include",
      signal,
    });
  } catch {
    return null; // Backend offline → Fallback
  }
  if (!res.ok) {
    // 404 / 500 → strukturierte Fehlermeldung extrahieren falls möglich,
    // damit Caller eine verständliche Meldung anzeigen kann statt still
    // auf den Client-Generator zurückzufallen (was bei echten Renderfehlern
    // ebenfalls fehlschlagen würde).
    let message = `Backend antwortete mit Status ${res.status}.`;
    try {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { message?: string; error?: string };
        if (j?.message) message = j.message;
        else if (j?.error) message = j.error;
      }
    } catch {
      /* noop */
    }
    // Bei 5xx (Renderfehler) Fehler werfen, damit kein leiser Client-Fallback erfolgt.
    if (res.status >= 500) throw new Error(message);
    // Bei 404 (z. B. Beleg gerade gelöscht) Fallback erlauben.
    return null;
  }
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error("Backend lieferte eine leere PDF-Datei.");
  }
  const etag = (res.headers.get("etag") ?? "").replace(/^"|"$/g, "");
  const fromCache = res.headers.get("x-pdf-cache") === "hit";
  return {
    blob,
    dateiname: parseDateiname(res.headers, `${art}-${id}.pdf`),
    hash: etag,
    fromCache,
  };
}
