// Avatar/Logo-Komponente für Kunden. Zeigt das hochgeladene Logo, wenn vorhanden,
// sonst Initialen-Fallback in `bg-muted`. Wiederverwendbar in Liste, Detail-Header
// und überall, wo der Kunde visuell repräsentiert wird.

import { kundeLogoUrl } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

interface KundeLike {
  id: string;
  firmenname?: string;
  vorname?: string;
  nachname?: string;
  nummer?: string;
  kuerzel?: string;
  hasLogo?: boolean;
  logoUpdatedAt?: string;
}

const SIZE_MAP = {
  sm: { box: "h-9 w-9", text: "text-xs" },
  md: { box: "h-12 w-12", text: "text-sm" },
  lg: { box: "h-16 w-16", text: "text-lg" },
  xl: { box: "h-20 w-20", text: "text-xl" },
} as const;

export function KundeLogo({
  kunde,
  size = "md",
  className,
}: {
  kunde: KundeLike;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}) {
  const cls = SIZE_MAP[size];
  const initialen =
    (kunde.kuerzel?.slice(0, 2) ||
      (kunde.firmenname
        ? kunde.firmenname.slice(0, 2)
        : `${(kunde.vorname ?? "")[0] ?? ""}${(kunde.nachname ?? "")[0] ?? ""}`) ||
      "K")
      .toUpperCase()
      .slice(0, 2);

  if (kunde.hasLogo) {
    return (
      <img
        src={kundeLogoUrl(kunde.id, kunde.logoUpdatedAt)}
        alt={kunde.firmenname || `${kunde.vorname ?? ""} ${kunde.nachname ?? ""}`.trim() || "Logo"}
        className={cn(
          cls.box,
          "shrink-0 rounded-2xl border border-border bg-card object-contain p-1",
          className,
        )}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        cls.box,
        cls.text,
        "grid shrink-0 place-content-center rounded-2xl bg-muted font-semibold text-muted-foreground",
        className,
      )}
      aria-label="Kein Logo"
    >
      {initialen}
    </div>
  );
}