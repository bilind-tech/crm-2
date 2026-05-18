// Stabile Snapshot-PDF-Vorschau für Protokolle.
// Wichtig: Die PDF wird NICHT bei jedem Tastendruck live neu geladen.
// Änderungen markieren die Vorschau nur als veraltet; aktualisiert wird kontrolliert.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { configurePdfWorker } from "@/lib/pdf/pdfjsWorker";

configurePdfWorker();
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { generateProtokollPdf } from "@/lib/pdf/werkzeugePdf";
import type { Protokoll, Kunde, Objekt, Firmendaten } from "@/lib/api/types";
import { PdfFieldOverlay } from "@/components/pdf-editor/PdfFieldOverlay";
import { protokollMetaForId, FALLBACK_HOTSPOTS_PROTOKOLL_SEITE_1 } from "@/lib/pdf/fieldMap";
import { A4, type RuntimeHotspot } from "@/lib/pdf/hotspotTracker";

const LOADER_DELAY_MS = 450;
const VOLATILE = new Set(["aktualisiertAm", "erstelltAm", "updatedAt", "createdAt"]);

function semKey<T>(o: T) {
  return JSON.stringify(o, (k, v) => (VOLATILE.has(k) ? undefined : v));
}

interface Props {
  draft: Protokoll;
  kunde?: Kunde;
  objekt?: Objekt;
  firma?: Firmendaten;
  /** Inline-Editor pro Hotspot (Render-Prop, identisch zu LivePdfPreview). */
  renderEditor?: (fieldId: string, close: () => void) => React.ReactNode;
}

export function ProtokollLivePreview({ draft, kunde, objekt, firma, renderEditor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<RuntimeHotspot[]>([]);
  const [openHotspotId, setOpenHotspotId] = useState<string | null>(null);

  const [loadAttempt, setLoadAttempt] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [queuedKey, setQueuedKey] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pdfUrlRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const latestKeyRef = useRef("");
  const builtKeyRef = useRef("");
  const hasVisiblePdfRef = useRef(false);
  const dataRef = useRef({ draft, kunde, objekt, firma });
  dataRef.current = { draft, kunde, objekt, firma };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const fb = setTimeout(() => setContainerWidth((w) => (w === 0 ? 600 : w)), 1000);
    return () => {
      ro.disconnect();
      clearTimeout(fb);
    };
  }, []);

  useEffect(() => {
    if (!rendering) {
      setShowLoader(false);
      return;
    }
    const t = setTimeout(() => setShowLoader(true), LOADER_DELAY_MS);
    return () => clearTimeout(t);
  }, [rendering]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  const draftKey = useMemo(() => semKey(draft), [draft]);
  const ctxKey = useMemo(() => semKey({ kunde, objekt, firma }), [kunde, objekt, firma]);
  const currentKey = useMemo(() => `${draftKey}|${ctxKey}`, [draftKey, ctxKey]);

  const runBuild = useCallback(async (requestedKey = latestKeyRef.current) => {
    if (inFlightRef.current || builtKeyRef.current === requestedKey) return;

    inFlightRef.current = true;
    latestKeyRef.current = requestedKey;
    setRendering(true);
    setBuildError(null);

    try {
      const { draft: d, kunde: k, objekt: o, firma: f } = dataRef.current;
      const { blob, hotspots: hs } = await generateProtokollPdf(d, k, o, f);
      if (!mountedRef.current) return;
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("PDF konnte nicht erzeugt werden (leerer Blob).");
      }

      const buf = await blob.arrayBuffer();
      if (!mountedRef.current) return;
      const newUrl = URL.createObjectURL(blob);

      if (requestedKey !== latestKeyRef.current) {
        URL.revokeObjectURL(newUrl);
        setQueuedKey(latestKeyRef.current);
        return;
      }

      const previousUrl = pdfUrlRef.current;
      builtKeyRef.current = requestedKey;
      hasVisiblePdfRef.current = true;
      pdfUrlRef.current = newUrl;

      setHotspots(hs);
      setPdfBuffer(buf);
      setPdfUrl(newUrl);
      setQueuedKey(null);
      setLoadAttempt(0);
      setViewerError(null);

      if (previousUrl) URL.revokeObjectURL(previousUrl);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[ProtokollLivePreview] build failed", e);
      if (mountedRef.current) setBuildError(e instanceof Error ? e.message : "PDF-Fehler");
    } finally {
      inFlightRef.current = false;
      if (!mountedRef.current) return;

      setRendering(false);
      const newestKey = latestKeyRef.current;
      if (newestKey !== builtKeyRef.current) {
        setQueuedKey(newestKey);
        if (!hasVisiblePdfRef.current) {
          window.setTimeout(() => {
            if (mountedRef.current) void runBuild(latestKeyRef.current);
          }, 0);
        }
      }
    }
  }, []);

  useEffect(() => {
    latestKeyRef.current = currentKey;
    if (builtKeyRef.current === currentKey) {
      setQueuedKey(null);
      return;
    }

    setQueuedKey(currentKey);
    if (!hasVisiblePdfRef.current && !inFlightRef.current) {
      void runBuild(currentKey);
    }
  }, [currentKey, runBuild]);

  const renderWidthRaw = useMemo(() => {
    const raw = Math.min(Math.max(containerWidth - 16, 280), 900);
    return Math.round(raw / 20) * 20;
  }, [containerWidth]);
  const renderWidth = useDeferredValue(renderWidthRaw);
  const scale = renderWidth / A4.width;

  const effectiveHotspots: RuntimeHotspot[] = useMemo(() => {
    if (hotspots.length > 0) return hotspots;
    return FALLBACK_HOTSPOTS_PROTOKOLL_SEITE_1.map((f) => ({
      id: f.id,
      page: f.page,
      x: f.box.x * A4.width,
      y: f.box.y * A4.height,
      w: f.box.w * A4.width,
      h: f.box.h * A4.height,
    }));
  }, [hotspots]);

  const fileSource = useMemo(
    () => (pdfBuffer ? { data: new Uint8Array(pdfBuffer.slice(0)) } : null),
    [pdfBuffer, loadAttempt],
  );

  const isStale = Boolean(queuedKey && queuedKey !== builtKeyRef.current && pdfBuffer);

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto bg-muted/30 px-2 py-3 sm:px-4">
      {(showLoader && rendering && pdfBuffer) || isStale ? (
        <div className="sticky top-2 z-20 ml-auto mb-2 flex w-fit items-center gap-2 rounded-full bg-background/95 px-2 py-1 text-[10px] text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
          {rendering ? (
            <>
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Vorschau wird aktualisiert</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Vorschau nicht aktuell</span>
            </>
          )}
          <button
            type="button"
            onClick={() => void runBuild(latestKeyRef.current)}
            disabled={rendering}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            Aktualisieren
          </button>
        </div>
      ) : null}

      {!pdfBuffer && !buildError && containerWidth > 0 && (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>PDF wird erzeugt …</span>
        </div>
      )}

      {buildError && !pdfBuffer && (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm">
          <p className="font-medium text-destructive">PDF konnte nicht erzeugt werden</p>
          <p className="text-xs text-muted-foreground">{buildError}</p>
          <button
            type="button"
            onClick={() => void runBuild(latestKeyRef.current)}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90"
          >
            <RefreshCw className="h-3 w-3" />
            Erneut versuchen
          </button>
        </div>
      )}

      {buildError && pdfBuffer && (
        <div className="sticky top-2 z-20 mx-auto mb-2 w-fit max-w-[90%] rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive">
          Letzte stabile Vorschau bleibt sichtbar — Aktualisierung fehlgeschlagen: {buildError}
        </div>
      )}

      {fileSource && containerWidth > 0 && !viewerError && (
        <Document
          file={fileSource}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setViewerError(null);
          }}
          onLoadError={(err) => {
            // eslint-disable-next-line no-console
            console.error("[ProtokollLivePreview] viewer error", {
              message: err?.message,
              byteLength: pdfBuffer?.byteLength ?? 0,
              loadAttempt,
              kind: draft.kind,
              draftId: draft.id,
            });
            const msg = err?.message || String(err);
            if (loadAttempt < 1 && pdfBuffer && /detached|already detached|neutered/i.test(msg)) {
              setLoadAttempt((n) => n + 1);
              return;
            }
            setViewerError(msg);
          }}
          loading={null}
          error={<div className="text-sm text-destructive">PDF kann nicht angezeigt werden.</div>}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
            const pageHotspots = effectiveHotspots.filter((h) => h.page === n);
            return (
              <div
                key={n}
                className="relative overflow-hidden rounded-md bg-background shadow-sm ring-1 ring-border"
              >
                <Page
                  pageNumber={n}
                  width={renderWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
                {renderEditor && (
                  <PdfFieldOverlay
                    hotspots={pageHotspots}
                    scale={scale}
                    openId={openHotspotId}
                    onOpenChange={setOpenHotspotId}
                    renderEditor={renderEditor}
                    metaForId={protokollMetaForId}
                  />
                )}
              </div>
            );
          })}
        </Document>
      )}

      {viewerError && pdfBuffer && (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm">
          <p className="font-medium text-destructive">PDF kann nicht angezeigt werden</p>
          <p className="text-xs text-muted-foreground">{viewerError}</p>
          <p className="font-mono text-[10px] text-muted-foreground/70">
            Quelle: ArrayBuffer · {Math.round((pdfBuffer?.byteLength ?? 0) / 1024)} KB · Versuch {loadAttempt + 1}
          </p>
          {pdfUrl && (
            <a href={pdfUrl} download className="mt-2 text-xs text-primary underline">
              PDF trotzdem herunterladen
            </a>
          )}
        </div>
      )}
    </div>
  );
}
