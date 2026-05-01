import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrimaryActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}

/**
 * Konsistenter primärer "Erstellen"-Button für die Page-Header.
 * Leichte Abrundung (rounded-lg), Gradient + sanftes Glow.
 */
export const PrimaryAction = React.forwardRef<HTMLButtonElement, PrimaryActionProps>(
  ({ icon: Icon = Plus, label, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          "group relative inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white",
          // Premium blue gradient (helleres, sattes Blau, nicht das dunkle Marineblau des Theme-primary)
          "bg-[linear-gradient(180deg,#3B82F6_0%,#2563EB_55%,#1D4ED8_100%)]",
          "shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_22px_-8px_rgba(37,99,235,0.55),0_1px_2px_rgba(15,23,42,0.18)]",
          "ring-1 ring-inset ring-white/15",
          "transition-all duration-150 ease-out",
          "hover:shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_12px_28px_-8px_rgba(37,99,235,0.7),0_1px_2px_rgba(15,23,42,0.2)]",
          "hover:brightness-[1.06] active:brightness-[0.96] active:translate-y-[0.5px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-60",
          className,
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    );
  },
);
PrimaryAction.displayName = "PrimaryAction";
