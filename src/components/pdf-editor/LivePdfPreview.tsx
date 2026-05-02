// Live-PDF-Vorschau für den Editor: rendert pdfmake-PDF aus dem Draft,
// debounced bei Änderungen, zeigt alle Seiten untereinander, mit klickbaren
// Hotspots pro Seite (PdfFieldOverlay).

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "@/lib/pdf/pdfjsWorker";
import { Loader2 } from "lucide-react";
import { generateAngebotPdf, generateRechnungPdf } from "@/lib/pdf/belegPdf";
import type { Angebot, Rechnung, Kunde, Firmendaten, Ansprechpartner } from "@/lib/api/types";
import { PdfFieldOverlay } from "./PdfFieldOverlay";
import { HOTSPOTS_SEITE_1, type Hotspot } from "@/lib/pdf/fieldMap";

interface CommonProps {
  kunde: Kunde;
  firma: Firmendaten;
  ansprechpartner?: Ansprechpartner;
  onHotspotClick: (h: Hotspot) => void;
}

type Props =
  | ({ kind: "angebot"; draft: Angebot } & CommonProps)
  | ({ kind: "rechnung"; draft: Rechnung } & CommonProps);

const DEBOUNCE_MS = 300;

export function LivePdfPreview(props: Props) {
  const { draft, kunde, firma, ansprechpartner, onHotspotClick, kind } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [rendering, setRendering] = useState(false);

  // Container-Breite messen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Debounced PDF-Build
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        const blob =
          kind === "angebot"
            ? await generateAngebotPdf(draft as Angebot, kunde, firma, ansprechpartner)
            : await generateRechnungPdf(draft as Rechnung, kunde, firma, ansprechpartner);
        if (cancelled) return;
        const newUrl = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return newUrl;
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, kunde, firma, ansprechpartner, kind]);

  // URL-Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderWidth = useMemo(() => Math.min(Math.max(containerWidth - 16, 280), 900), [containerWidth]);

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto bg-muted/30 px-2 py-3 sm:px-4">
      {rendering && (
        <div className="pointer-events-none sticky top-2 z-20 ml-auto flex w-fit items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin" />
          aktualisiert …
        </div>
      )}

      {!pdfUrl && containerWidth > 0 && (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>PDF wird erzeugt …</span>
        </div>
      )}

      {pdfUrl && containerWidth > 0 && (
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={null}
          error={<div className="text-sm text-destructive">PDF kann nicht angezeigt werden.</div>}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
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
              {pageNum === 1 && (
                <PdfFieldOverlay
                  hotspots={HOTSPOTS_SEITE_1}
                  onHotspotClick={onHotspotClick}
                />
              )}
            </div>
          ))}
        </Document>
      )}
    </div>
  );
}
