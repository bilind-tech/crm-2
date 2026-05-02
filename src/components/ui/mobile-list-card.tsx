import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileListCardProps {
  onClick?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Kompakte Listen-Karte für Mobile-Ansichten (ersetzt Tabellen unterhalb md).
 * - Title (fett) + optionaler Subtitle
 * - Meta-Zeile (z. B. Datum, Nummer)
 * - Trailing-Slot rechts (z. B. Betrag) + Status-Badge darunter
 * - Optionale Action-Row unten (Buttons, stoppt Propagation)
 */
export function MobileListCard({
  onClick,
  title,
  subtitle,
  meta,
  trailing,
  badge,
  actions,
  footer,
  className,
}: MobileListCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm shadow-sm transition-colors",
        onClick && "cursor-pointer hover:border-primary/30 hover:bg-accent/30 active:bg-accent/50",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-tight">{title}</div>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
          {meta && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {trailing && <div className="text-right font-semibold">{trailing}</div>}
          {badge}
        </div>
        {onClick && !actions && (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </div>
      {footer && <div className="min-w-0">{footer}</div>}
      {actions && (
        <div
          className="flex items-center justify-end gap-1 border-t border-border pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
