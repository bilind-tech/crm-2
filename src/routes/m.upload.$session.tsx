import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Trash2, Check, Loader2, FolderOpen, FileText, AlertTriangle, RotateCw, WifiOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { uploadDokumentToSessionMitProgress, MAX_BYTES } from "@/lib/dokument/upload";
import { getBackendUrl } from "@/lib/api/backendUrl";

export const Route = createFileRoute("/m/upload/$session")({
  component: MobileUploadPage,
});

type Status = "wartet" | "laeuft" | "fertig" | "fehler";

interface DateiEntry {
  id: string;
  file: File;
  previewUrl: string;
  istBild: boolean;
  status: Status;
  progress: number;
  versuche: number;
  fehler?: string;
  fehlerStatus?: number;
  fehlerSchritt?: string;
}

const MAX_PARALLEL = 2;
const MAX_VERSUCHE = 3;

// FileButton ist absichtlich AUF MODUL-EBENE definiert (stabiler Komponententyp).
// Innerhalb der Page-Funktion definiert würde iOS Safari den <input type="file">
// bei jedem Re-Render unmounten und der `change`-Event käme nicht zuverlässig an.
function FileButton({
  icon: Icon,
  label,
  accept,
  capture,
  multiple,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accept: string;
  capture?: "environment" | "user";
  multiple?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <div
        className={
          "pointer-events-none flex h-14 w-full items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold text-white " +
          "bg-[linear-gradient(180deg,#3B82F6_0%,#2563EB_55%,#1D4ED8_100%)] " +
          "shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_22px_-8px_rgba(37,99,235,0.55),0_1px_2px_rgba(15,23,42,0.18)] " +
          "ring-1 ring-inset ring-white/15"
        }
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </div>
      <input
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        {...(multiple ? { multiple: true } : {})}
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={label}
      />
    </div>
  );
}

function MobileUploadPage() {
  return <MobileUploadInner />;
}

function DiagnoseBlock({
  token,
  entries,
}: {
  token: string;
  entries: DateiEntry[];
}) {
  const [kopiert, setKopiert] = useState(false);
  if (entries.length === 0) return null;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "n/a";
  const tokenKurz = token.slice(0, 6) + "…" + token.slice(-4);
  const zeilen = entries.map((e) => {
    return [
      `Datei: ${e.file.name}`,
      `Typ: ${e.file.type || "unbekannt"}`,
      `Größe: ${Math.round(e.file.size / 1024)} KB`,
      `Schritt: ${e.fehlerSchritt ?? "upload"}`,
      `HTTP: ${e.fehlerStatus ?? 0}`,
      `Fehler: ${e.fehler ?? "-"}`,
    ].join(" | ");
  });
  const text =
    `Handy-Upload-Fehler\n` +
    `Zeit: ${new Date().toISOString()}\n` +
    `Session: ${tokenKurz}\n` +
    `Browser: ${ua}\n\n` +
    zeilen.join("\n");
  async function kopiere() {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    } catch {
      toast.error("Kopieren nicht möglich — Text bitte markieren.");
    }
  }
  return (
    <div className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="font-semibold text-destructive">
            {entries.length === 1 ? "Eine Datei ist nicht angekommen" : `${entries.length} Dateien sind nicht angekommen`}
          </p>
          <p className="text-xs text-muted-foreground">
            Bitte einmal „Erneut“ versuchen. Falls es weiter nicht klappt: Fehlerdetails kopieren und an den Support schicken.
          </p>
        </div>
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
        {text}
      </pre>
      <button
        type="button"
        onClick={kopiere}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold"
      >
        {kopiert ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        {kopiert ? "Kopiert" : "Fehlerdetails kopieren"}
      </button>
    </div>
  );
}

function MobileUploadInner() {
  const { session: token } = Route.useParams();
  const [dateien, setDateien] = useState<DateiEntry[]>([]);
  const dateienRef = useRef<DateiEntry[]>([]);
  dateienRef.current = dateien;
  const [sessionState, setSessionState] = useState<"prueft" | "ok" | "fehlt" | "offline">("prueft");

  // Session beim Laden einmal validieren — sonst weiß der Nutzer nicht,
  // ob der QR-Code überhaupt noch gültig ist.
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/upload-sessions/${token}`, {
          credentials: "include",
        });
        if (abgebrochen) return;
        if (res.ok) setSessionState("ok");
        else setSessionState("fehlt");
      } catch {
        if (!abgebrochen) setSessionState("offline");
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [token]);

  const updateEntry = useCallback((id: string, patch: Partial<DateiEntry>) => {
    setDateien((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const starteUpload = useCallback(
    async (id: string) => {
      const e = dateienRef.current.find((x) => x.id === id);
      if (!e) return;
      updateEntry(id, { status: "laeuft", progress: 0, fehler: undefined });
      const stamp = new Date();
      const datum = stamp.toISOString().slice(0, 10);
      const titel = e.istBild
        ? `Foto ${stamp.toLocaleDateString("de-DE")} ${stamp
            .toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
        : e.file.name.replace(/\.[^.]+$/, "");
      try {
        await uploadDokumentToSessionMitProgress(
          token,
          e.file,
          { titel, dokumentdatum: datum, quelle: "handy-scan", steuerrelevant: false },
          (ratio) => updateEntry(id, { progress: ratio }),
        );
        if (e.previewUrl) {
          // Preview behalten für Anzeige – aber später beim Entfernen revoken.
        }
        updateEntry(id, { status: "fertig", progress: 1 });
      } catch (err) {
        const status = (err as { status?: number })?.status ?? 0;
        const versuche = (dateienRef.current.find((x) => x.id === id)?.versuche ?? 0) + 1;
        const msg =
          err instanceof Error ? err.message : "Upload fehlgeschlagen";
        if (status === 429 && versuche < MAX_VERSUCHE) {
          updateEntry(id, { status: "wartet", versuche, fehler: undefined });
          setTimeout(() => starteUpload(id), 2000);
          return;
        }
        updateEntry(id, {
          status: "fehler",
          versuche,
          fehler: msg,
          fehlerStatus: status,
          fehlerSchritt: "upload",
        });
      }
    },
    [token, updateEntry],
  );

  // Queue: solange < MAX_PARALLEL laufen, nächsten "wartet"-Eintrag starten.
  useEffect(() => {
    const laufend = dateien.filter((e) => e.status === "laeuft").length;
    if (laufend >= MAX_PARALLEL) return;
    const naechster = dateien.find((e) => e.status === "wartet");
    if (!naechster) return;
    starteUpload(naechster.id);
  }, [dateien, starteUpload]);

  function verarbeite(files: FileList | File[]) {
    // WICHTIG (iOS Safari): Datei-Liste SYNCHRON in ein echtes Array kopieren,
    // bevor irgendetwas async passiert. Sonst kann iOS die Datei-Referenzen
    // verlieren, wenn der Input zwischendurch geleert oder neu gerendert wird.
    const list = Array.from(files as ArrayLike<File>);
    if (!list.length) return;
    const neue: DateiEntry[] = [];
    for (const f of list) {
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" ist größer als 20 MB`);
        continue;
      }
      const istBild = f.type.startsWith("image/");
      let previewUrl = "";
      if (istBild) {
        try { previewUrl = URL.createObjectURL(f); } catch { previewUrl = ""; }
      }
      neue.push({
        id: Math.random().toString(36).slice(2),
        file: f,
        previewUrl,
        istBild,
        status: "wartet",
        progress: 0,
        versuche: 0,
      });
    }
    if (neue.length) setDateien((prev) => [...prev, ...neue]);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = input.files;
    // ZUERST übernehmen, DANN Input leeren — sonst verliert iOS die FileList,
    // bevor wir die Dateien synchron in unseren State kopiert haben.
    if (files && files.length > 0) {
      verarbeite(files);
    } else {
      toast.error("Keine Datei erhalten — bitte erneut auswählen.");
    }
    try { input.value = ""; } catch { /* iOS: stillschweigend ignorieren */ }
  }

  function entferne(id: string) {
    setDateien((p) => {
      const x = p.find((f) => f.id === id);
      if (x?.previewUrl) URL.revokeObjectURL(x.previewUrl);
      return p.filter((f) => f.id !== id);
    });
  }

  // Object-URLs am Ende aufräumen.
  useEffect(() => {
    return () => {
      dateienRef.current.forEach((e) => {
        if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
      });
    };
  }, []);

  const total = dateien.length;
  const fertig = dateien.filter((e) => e.status === "fertig").length;
  const fehler = dateien.filter((e) => e.status === "fehler").length;
  const aktiv = dateien.filter((e) => e.status === "laeuft" || e.status === "wartet").length;
  const allesFertig = total > 0 && fertig === total;
  const overallProgress = total === 0 ? 0 : (fertig + dateien.reduce((s, e) => s + (e.status === "laeuft" ? e.progress : 0), 0)) / total;

  if (sessionState === "fehlt" || sessionState === "offline") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        {sessionState === "offline" ? (
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        ) : (
          <AlertTriangle className="h-10 w-10 text-destructive" />
        )}
        <h1 className="text-lg font-semibold">
          {sessionState === "offline" ? "Keine Verbindung zum PC" : "Sitzung nicht mehr gültig"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {sessionState === "offline"
            ? "Bist du im selben WLAN wie der PC? Bitte Verbindung prüfen und Seite neu laden."
            : "Bitte am PC erneut auf „Vom Handy scannen“ klicken und den neuen QR-Code scannen."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <RotateCw className="h-4 w-4" /> Neu laden
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <h1 className="text-base font-semibold">Dateien hochladen</h1>
        <p className="text-xs text-muted-foreground">
          Foto aufnehmen oder Datei wählen — Upload läuft automatisch.
        </p>
      </header>

      <main className="flex-1 space-y-3 p-4 pb-32">
        <FileButton
          icon={Camera}
          label={total === 0 ? "Foto aufnehmen" : "Noch ein Foto"}
          accept="image/*"
          capture="environment"
          onChange={onPick}
        />
        <FileButton
          icon={FolderOpen}
          label="Aus Galerie / Dateien"
          accept="image/*,application/pdf"
          multiple
          onChange={onPick}
        />

        {fehler > 0 && (
          <DiagnoseBlock
            token={token}
            entries={dateien.filter((e) => e.status === "fehler")}
          />
        )}

        {allesFertig && (
          <div className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm text-success">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">
                {total === 1 ? "Datei gespeichert — am PC sichtbar." : `${total} Dateien gespeichert — am PC sichtbar.`}
              </p>
              <p className="text-xs opacity-80">Du kannst weitere Dateien hinzufügen.</p>
            </div>
          </div>
        )}

        {total > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium">
              {total} Datei{total === 1 ? "" : "en"} · {fertig} gespeichert
              {fehler > 0 ? ` · ${fehler} Fehler` : ""}
            </p>
            <ul className="space-y-3">
              {dateien.map((f) => {
                const statusLabel =
                  f.status === "wartet"
                    ? "Wartet…"
                    : f.status === "laeuft"
                      ? `Wird hochgeladen… ${Math.round(f.progress * 100)}%`
                      : f.status === "fertig"
                        ? "Gespeichert — am PC sichtbar"
                        : f.fehler || "Upload fehlgeschlagen";
                const statusColor =
                  f.status === "fertig"
                    ? "text-success"
                    : f.status === "fehler"
                      ? "text-destructive"
                      : "text-muted-foreground";
                return (
                  <li
                    key={f.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="relative aspect-[4/3] w-full bg-muted">
                      {f.istBild && f.previewUrl ? (
                        <img
                          src={f.previewUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                          <FileText className="h-10 w-10 text-muted-foreground" />
                          <span className="break-all text-xs text-muted-foreground">
                            {f.file.name}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => entferne(f.id)}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-destructive shadow"
                        aria-label="Entfernen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {f.status === "fertig" && (
                        <div className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-success text-white shadow">
                          <Check className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    {/* Status-Zeile + Fortschritt unter Bild — immer sichtbar. */}
                    <div className="space-y-2 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`flex items-center gap-1.5 font-medium ${statusColor}`}>
                          {f.status === "laeuft" || f.status === "wartet" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : f.status === "fertig" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                          <span>{statusLabel}</span>
                        </span>
                        {f.status === "fehler" && (
                          <button
                            type="button"
                            onClick={() => starteUpload(f.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground"
                          >
                            <RotateCw className="h-3 w-3" /> Erneut
                          </button>
                        )}
                      </div>
                      {(f.status === "laeuft" || f.status === "wartet") && (
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.round((f.status === "laeuft" ? f.progress : 0) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>

      {total > 0 && !allesFertig && (
        <div className="sticky bottom-0 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {fertig} von {total} gesendet
              {fehler > 0 ? ` · ${fehler} Fehler` : ""}
            </span>
            <span>{aktiv > 0 ? "läuft…" : ""}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.round(overallProgress * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
