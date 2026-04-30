import { Link } from "@tanstack/react-router";
import { Home, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  breadcrumb: string;
  /** @deprecated wird nicht mehr angezeigt */
  hint?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, actions }: Props) {
  return (
    <div className="space-y-2">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="flex items-center hover:text-foreground">
          <Home className="h-3.5 w-3.5" />
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{breadcrumb}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface KpiProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "primary";
  icon?: React.ComponentType<{ className?: string }>;
}

export function KpiCard({ label, value, sublabel, tone = "default", icon: Icon }: KpiProps) {
  const valueColor =
    tone === "success"
      ? "text-success"
      : tone === "danger"
      ? "text-destructive"
      : tone === "primary"
      ? "text-primary"
      : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
          {sublabel && (
            <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
