// Echte PDF als einzige Wahrheit. Auto-Rebuild mit kurzem Debounce nach
// Änderung — fühlt sich an wie Live-Bearbeitung in Word: tippen → kleine
// Pause → PDF aktualisiert sich von selbst, ohne Knopfdruck und ohne
// sichtbares Flackern.
//
// Anti-Flacker:
//  - `<Document>` wird nie unmountet.
//  - Neuer Build wird offscreen vorgeladen und erst atomar getauscht,
//    sobald das neue Dokument bereit ist. So bleibt die alte Seite stehen,
//    bis die neue gezeichnet ist.
//  - Status-Indikator erscheint erst, wenn der Build > 350 ms dauert.
//
// Trigger:
//  - Jede Draft-Änderung → Debounce 450 ms → Build.
//  - Imperatives `flush()` (z. B. Popover-Close, Blur, Checkbox-Klick) →
//    sofortiger Build, falls Änderungen anstehen.
//  - Window-Blur / `visibilitychange` → ebenfalls flush.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { configurePdfWorker } from "@/lib/pdf/pdfjsWorker";

configurePdfWorker();

import { AlertCircle, Loader2 } from "lucide-react";
import { generateProtokollPdf } from "@/lib/pdf/werkzeugePdf";
import type { Protokoll, Kunde, Objekt, Firmendaten } from "@/lib/api/types";
import { PdfFieldOverlay, type TableAction } from "@/components/pdf-editor/PdfFieldOverlay";
import {
  protokollMetaForId,
  FALLBACK_HOTSPOTS_PROTOKOLL_SEITE_1,
} from "@/lib/pdf/fieldMap";
import { A4, type RuntimeHotspot } from "@/lib/pdf/hotspotTracker";

const DEBOUNCE_MS = 450;
const LOADER_DELAY_MS = 350;
const VOLATILE = new Set(["aktualisiertAm", "erstelltAm", "updatedAt", "createdAt"]);

function semKey<T>(o: T) {
  return JSON.stringify(o, (k, v) => (VOLATILE.has(k) ? undefined : v));
}

export interface ProtokollLivePreviewHandle {
  /** Sofortigen Build erzwingen (debounce überspringen). */
  flush: () => void;
}

interface Props {
  draft: Protokoll;
  kunde?: Kunde;
  objekt?: Objekt;
  firma?: Firmendaten;
  renderEditor?: (fieldId: string, close: () => void) => React.ReactNode;
  tableActions?: TableAction;
}

export const ProtokollLivePreview = forwardRef<ProtokollLivePreviewHandle, Props>(
  function ProtokollLivePreview(
    { draft, kunde, objekt, firma, renderEditor, tableActions },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Sichtbarer Stand
    const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
    const [hotspots, setHotspots] = useState<RuntimeHotspot[]>([]);
    const [numPages, setNumPages] = useState(0);
    const [openHotspotId, setOpenHotspotId] = useState<string | null>(null);

    // Vorgeladener nächster Build (für atomaren Swap)
    const [pendingBuffer, setPendingBuffer] = useState<ArrayBuffer | null>(null);
    const pendingHotspotsRef = useRef<RuntimeHotspot[]>([]);

    const [building, setBuilding] = useState(false);
    const [showLoader, setShowLoader] = useState(false);
    const [buildError, setBuildError] = useState<string | null>(null);
    const [viewerError, setViewerError] = useState<string | null>(null);

    const mountedRef = useRef(true);
    const inFlightRef = useRef(false);
    const builtKeyRef = useRef<string>("");
    const latestKeyRef = useRef<string>("");
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dataRef = useRef({ draft, kunde, objekt, firma });
    dataRef.current = { draft, kunde, objekt, firma };

    // Container-Breite messen
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
      return () => {
        mountedRef.current = false;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      };
    }, []);

    // Loader nur nach kurzer Wartezeit zeigen (vermeidet Flicker bei schnellen Builds)
    useEffect(() => {
      if (!building) {
        setShowLoader(false);
        return;
      }
      const t = setTimeout(() => setShowLoader(true), LOADER_DELAY_MS);
      return () => clearTimeout(t);
    }, [building]);

    const currentKey = useMemo(
      () => semKey({ draft, kunde, objekt, firma, kind: draft.kind }),
      [draft, kunde, objekt, firma],
    );
    latestKeyRef.current = currentKey;

    const runBuild = useCallback(async () => {
      if (inFlightRef.current) return;
      const targetKey = latestKeyRef.current;
      if (builtKeyRef.current === targetKey) return;

      inFlightRef.current = true;
      setBuilding(true);
      setBuildError(null);

      try {
        const { draft: d, kunde: k, objekt: o, firma: f } = dataRef.current;
        const t0 = performance.now();
        const { blob, hotspots: hs } = await generateProtokollPdf(d, k, o, f);
        if (!mountedRef.current) return;
        if (!(blob instanceof Blob) || blob.size === 0) {
          throw new Error("PDF konnte nicht erzeugt werden (leerer Blob).");
        }
        const buf = await blob.arrayBuffer();
        if (!mountedRef.current) return;

        // eslint-disable-next-line no-console
        console.debug(`[protokoll-build] ${Math.round(performance.now() - t0)}ms`);

        // Erster Build → direkt anzeigen (kein offscreen-Preload nötig).
        if (!pdfBuffer) {
          setPdfBuffer(buf);
          setHotspots(hs);
          builtKeyRef.current = targetKey;
        } else {
          // Folge-Build → in Pending parken, atomarer Swap nach onLoadSuccess.
          pendingHotspotsRef.current = hs;
          setPendingBuffer(buf);
          // builtKeyRef wird erst beim Swap aktualisiert.
          builtKeyRef.current = targetKey;
        }
        setViewerError(null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[ProtokollLivePreview] build failed", e);
        if (mountedRef.current) {
          setBuildError(e instanceof Error ? e.message : "PDF-Fehler");
        }
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setBuilding(false);
          // Wenn währenddessen ein neuer Key reingekommen ist, gleich nachziehen.
          if (latestKeyRef.current !== builtKeyRef.current) {
            // Microtask, damit React zwischendurch rendern kann.
            queueMicrotask(() => {
              if (mountedRef.current) void runBuild();
            });
          }
        }
      }
    }, [pdfBuffer]);

    const scheduleBuild = useCallback(() => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runBuild();
      }, DEBOUNCE_MS);
    }, [runBuild]);

    const flush = useCallback(() => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (latestKeyRef.current === builtKeyRef.current) return;
      void runBuild();
    }, [runBuild]);

    useImperativeHandle(ref, () => ({ flush }), [flush]);

    // Erster Build, sobald Container vermessen ist.
    const didInitRef = useRef(false);
    useEffect(() => {
      if (didInitRef.current) return;
      if (containerWidth === 0) return;
      didInitRef.current = true;
      void runBuild();
    }, [containerWidth, runBuild]);

    // Reagiere auf Draft/Context-Änderungen → debounced rebuild.
    useEffect(() => {
      if (!didInitRef.current) return;
      if (builtKeyRef.current === currentKey) return;
      scheduleBuild();
    }, [currentKey, scheduleBuild]);

    // Tab-Wechsel / Window-Blur → sofort flushen.
    useEffect(() => {
      const onBlur = () => flush();
      const onVis = () => {
        if (document.visibilityState === "hidden") flush();
      };
      window.addEventListener("blur", onBlur);
      document.addEventListener("visibilitychange", onVis);
      return () => {
        window.removeEventListener("blur", onBlur);
        document.removeEventListener("visibilitychange", onVis);
      };
    }, [flush]);

    const renderWidth = useMemo(() => {
      const raw = Math.min(Math.max(containerWidth - 16, 280), 900);
      return Math.round(raw / 20) * 20;
    }, [containerWidth]);
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

    // Frische Kopie pro Document-Load — sonst detacht PDF.js den Buffer.
    const fileSource = useMemo(
      () => (pdfBuffer ? { data: new Uint8Array(pdfBuffer.slice(0)) } : null),
      [pdfBuffer],
    );
    const pendingFileSource = useMemo(
      () => (pendingBuffer ? { data: new Uint8Array(pendingBuffer.slice(0)) } : null),
      [pendingBuffer],
    );

    return (
      <div
        ref={containerRef}
        className="relative h-full overflow-y-auto bg-muted/30 px-2 py-3 sm:px-4"
      >
        {/* Subtiler Status-Indikator */}
        {(showLoader && building) || buildError ? (
          <div className="pointer-events-none sticky top-2 z-20 mb-2 flex justify-end">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
              {buildError ? (
                <span
                  title={buildError}
                  className="flex items-center gap-1 text-destructive"
                >
                  <AlertCircle className="h-2.5 w-2.5" />
                  Aktualisierung fehlgeschlagen
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  aktualisiert …
                </span>
              )}
            </div>
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
          </div>
        )}

        {/* Sichtbares Dokument (bleibt stehen, bis pendingBuffer fertig geladen ist). */}
        {fileSource && containerWidth > 0 && !viewerError && (
          <Document
            file={fileSource}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setViewerError(null);
            }}
            onLoadError={(err) => {
              // eslint-disable-next-line no-console
              console.error("[ProtokollLivePreview] viewer error", err);
              setViewerError(err?.message || String(err));
            }}
            loading={null}
            error={<div className="text-sm text-destructive">PDF kann nicht angezeigt werden.</div>}
            className="flex flex-col items-center gap-4"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
              const pageHotspots = effectiveHotspots.filter((h) => h.page === pageNum);
              return (
                <div
                  key={pageNum}
                  className="relative overflow-hidden rounded-md bg-background shadow-sm ring-1 ring-border"
                >
                  <Page
                    pageNumber={pageNum}
                    width={renderWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                  {renderEditor && (
                    <PdfFieldOverlay
                      hotspots={pageHotspots}
                      scale={scale}
                      openId={openHotspotId}
                      onOpenChange={(id) => {
                        setOpenHotspotId(id);
                        // Beim Schließen eines Popovers → sofortiger Build der letzten Änderung.
                        if (id === null) flush();
                      }}
                      renderEditor={renderEditor}
                      metaForId={protokollMetaForId}
                      tableActions={tableActions}
                    />
                  )}
                </div>
              );
            })}
          </Document>
        )}

        {/* Versteckter Preload: wartet bis die neue PDF parse-fertig ist, dann atomarer Swap. */}
        {pendingFileSource && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: -99999,
              top: 0,
              width: 1,
              height: 1,
              overflow: "hidden",
              pointerEvents: "none",
              opacity: 0,
            }}
          >
            <Document
              file={pendingFileSource}
              loading={null}
              error={null}
              onLoadSuccess={() => {
                if (!mountedRef.current) return;
                // Atomarer Swap
                setPdfBuffer(pendingBuffer);
                setHotspots(pendingHotspotsRef.current);
                setPendingBuffer(null);
              }}
              onLoadError={(err) => {
                // eslint-disable-next-line no-console
                console.error("[ProtokollLivePreview] pending load error", err);
                // Fallback: trotzdem swappen, damit User aktuelle Daten sieht.
                if (!mountedRef.current) return;
                setPdfBuffer(pendingBuffer);
                setHotspots(pendingHotspotsRef.current);
                setPendingBuffer(null);
              }}
            >
              <Page pageNumber={1} width={120} renderAnnotationLayer={false} renderTextLayer={false} />
            </Document>
          </div>
        )}

        {viewerError && pdfBuffer && (
          <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm">
            <p className="font-medium text-destructive">PDF kann nicht angezeigt werden</p>
            <p className="text-xs text-muted-foreground">{viewerError}</p>
          </div>
        )}
      </div>
    );
  },
);