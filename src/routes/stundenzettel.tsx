// Eingebettete Ansicht der externen Stundenzettel-App per iframe.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Clock, ExternalLink, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { getStundenzettelUrl } from "@/lib/stundenzettel/config";

export const Route = createFileRoute("/stundenzettel")({ component: Page });

function Page() {
  const [url, setUrl] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const sync = () => setUrl(getStundenzettelUrl());
    sync();
    window.addEventListener("stundenzettel-url-changed", sync);
    return () => window.removeEventListener("stundenzettel-url-changed", sync);
  }, []);

  // Wenn iframe nach 6s nicht geladen hat, gehen wir von einer Blockade aus.
  useEffect(() => {
    if (!url) return;
    setLoaded(false);
    setBlocked(false);
    const t = setTimeout(() => {
      if (!loaded) setBlocked(true);
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadKey]);

  if (!url) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Stundenzettel"
          subtitle="Externe App für Arbeitszeit-Erfassung."
        />
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-semibold">Noch nicht eingerichtet</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
            Die Stundenzettel-App läuft als eigener Dienst auf dem Pi. Hinterlege ihre
            Adresse in den Einstellungen, dann erscheint sie hier eingebettet.
          </p>
          <Button asChild className="gap-1.5 rounded-full px-5">
            <Link to="/einstellungen">
              <SettingsIcon className="h-4 w-4" />
              Zu den Einstellungen
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Stundenzettel</h1>
          <span className="truncate text-xs text-muted-foreground">{url}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Neu laden
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            In neuem Tab
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {blocked && !loaded && (
          <div className="absolute inset-0 z-10 grid place-content-center bg-background/95 p-6 text-center">
            <div className="mx-auto max-w-md space-y-3">
              <h3 className="text-base font-semibold">Einbettung blockiert</h3>
              <p className="text-sm text-muted-foreground">
                Die App lässt sich nicht im iframe anzeigen (vermutlich CSP- oder
                X-Frame-Options-Header). Öffne sie stattdessen in einem neuen Tab.
              </p>
              <Button
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                className="gap-1.5 rounded-full px-5"
              >
                <ExternalLink className="h-4 w-4" />
                Stundenzettel öffnen
              </Button>
            </div>
          </div>
        )}
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={url}
          title="Stundenzettel"
          className="h-full w-full"
          onLoad={() => {
            setLoaded(true);
            setBlocked(false);
          }}
        />
      </div>
    </div>
  );
}
