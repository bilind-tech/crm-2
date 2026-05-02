// Klickbare, durchscheinende Hotspot-Layer über einer PDF-Seite.
// Liegt absolut über dem react-pdf <Page> und reagiert auf Hover/Klick.

import { Pencil } from "lucide-react";
import type { Hotspot } from "@/lib/pdf/fieldMap";

interface Props {
  hotspots: Hotspot[];
  onHotspotClick: (h: Hotspot) => void;
}

export function PdfFieldOverlay({ hotspots, onHotspotClick }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {hotspots.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHotspotClick(h);
          }}
          aria-label={`Bearbeiten: ${h.label}`}
          title={`Bearbeiten: ${h.label}`}
          className="pointer-events-auto group absolute flex items-start justify-end rounded-md border border-transparent transition hover:border-dashed hover:border-primary/70 hover:bg-primary/5 focus:outline-none focus-visible:border-primary focus-visible:bg-primary/10"
          style={{
            left: `${h.box.x * 100}%`,
            top: `${h.box.y * 100}%`,
            width: `${h.box.w * 100}%`,
            height: `${h.box.h * 100}%`,
          }}
        >
          <span className="pointer-events-none m-1 hidden items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm group-hover:inline-flex group-focus-visible:inline-flex">
            <Pencil className="h-2.5 w-2.5" />
            {h.label}
          </span>
        </button>
      ))}
    </div>
  );
}
