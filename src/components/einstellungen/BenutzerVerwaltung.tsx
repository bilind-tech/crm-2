// Benutzer-Verwaltung (Owner-only): Anlegen, Rolle ändern, Aktivieren/Deaktivieren,
// Passwort zurücksetzen. Initial-Passwort + Recovery-Code werden EINMALIG nach
// Anlegen/Reset im Dialog angezeigt.
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, KeyRound, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Section } from "./_shared";
import { useConfirm } from "@/hooks/useConfirm";
import { useAuth } from "@/lib/auth";
import {
  useBenutzer,
  useBenutzerAnlegen,
  useBenutzerPatch,
  useBenutzerPasswortReset,
} from "@/hooks/useApi";
import type { BenutzerEintrag, BenutzerRolle } from "@/lib/api/types";

type Geheimnis = { titel: string; passwort?: string; recoveryCode: string };

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function GeheimnisDialog({
  data,
  onClose,
}: {
  data: Geheimnis | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>{data?.titel}</DialogTitle>
          <DialogDescription>
            Diese Daten werden NUR EINMAL angezeigt. Bitte sicher notieren.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {data?.passwort && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Initial-Passwort</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
                <span className="flex-1 break-all">{data.passwort}</span>
                <CopyButton value={data.passwort} />
              </div>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Recovery-Code</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
              <span className="flex-1 break-all">{data?.recoveryCode}</span>
              {data && <CopyButton value={data.recoveryCode} />}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Verstanden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnlegenDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (g: Geheimnis) => void;
}) {
  const [username, setUsername] = useState("");
  const [rolle, setRolle] = useState<BenutzerRolle>("mitarbeiter");
  const anlegen = useBenutzerAnlegen();

  function reset() {
    setUsername("");
    setRolle("mitarbeiter");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>Benutzer anlegen</DialogTitle>
          <DialogDescription>
            Initial-Passwort und Recovery-Code werden automatisch erzeugt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Benutzername</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="z. B. max.mustermann"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Rolle</label>
            <Select value={rolle} onValueChange={(v) => setRolle(v as BenutzerRolle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                <SelectItem value="owner">Owner (volle Rechte)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            disabled={username.trim().length < 3 || anlegen.isPending}
            onClick={() =>
              anlegen.mutate(
                { username: username.trim(), rolle },
                {
                  onSuccess: (res) => {
                    onOpenChange(false);
                    reset();
                    onCreated({
                      titel: `Benutzer „${res.username}" angelegt`,
                      passwort: res.initialPasswort,
                      recoveryCode: res.recoveryCode,
                    });
                  },
                  onError: (err: unknown) => {
                    const e = err as { body?: { error?: string } };
                    toast.error(
                      e.body?.error === "username-conflict"
                        ? "Benutzername bereits vergeben"
                        : "Anlegen fehlgeschlagen",
                    );
                  },
                },
              )
            }
          >
            Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BenutzerVerwaltung() {
  const { user } = useAuth();
  const { data: benutzer = [] } = useBenutzer();
  const patch = useBenutzerPatch();
  const reset = useBenutzerPasswortReset();
  const { confirm, dialog } = useConfirm();
  const [anlegenOpen, setAnlegenOpen] = useState(false);
  const [geheimnis, setGeheimnis] = useState<Geheimnis | null>(null);

  function handleAktiv(b: BenutzerEintrag, neu: boolean) {
    confirm(
      {
        title: neu ? "Benutzer aktivieren?" : "Benutzer deaktivieren?",
        description: neu
          ? `${b.username} kann sich wieder anmelden.`
          : `${b.username} kann sich nicht mehr anmelden. Aktive Sitzungen werden beendet.`,
        variant: neu ? "default" : "destructive",
        confirmLabel: neu ? "Aktivieren" : "Deaktivieren",
      },
      () =>
        patch.mutate(
          { id: b.id, aktiv: neu },
          {
            onSuccess: () => toast.success(neu ? "Aktiviert" : "Deaktiviert"),
            onError: (err: unknown) => {
              const e = err as { body?: { error?: string } };
              toast.error(
                e.body?.error === "last-owner"
                  ? "Letzter Owner kann nicht deaktiviert werden"
                  : "Aktion fehlgeschlagen",
              );
            },
          },
        ),
    );
  }

  function handleRolle(b: BenutzerEintrag, neu: BenutzerRolle) {
    if (b.rolle === neu) return;
    patch.mutate(
      { id: b.id, rolle: neu },
      {
        onSuccess: () => toast.success("Rolle geändert"),
        onError: (err: unknown) => {
          const e = err as { body?: { error?: string } };
          toast.error(
            e.body?.error === "last-owner"
              ? "Letzter Owner kann nicht degradiert werden"
              : "Rollenwechsel fehlgeschlagen",
          );
        },
      },
    );
  }

  function handleReset(b: BenutzerEintrag) {
    confirm(
      {
        title: `Passwort von ${b.username} zurücksetzen?`,
        description:
          "Neues Initial-Passwort und Recovery-Code werden erzeugt. Aktive Sitzungen werden beendet.",
        variant: "destructive",
        confirmLabel: "Zurücksetzen",
      },
      () =>
        reset.mutate(b.id, {
          onSuccess: (r) =>
            setGeheimnis({
              titel: `Passwort für „${b.username}" zurückgesetzt`,
              passwort: r.initialPasswort,
              recoveryCode: r.recoveryCode,
            }),
          onError: () => toast.error("Reset fehlgeschlagen"),
        }),
    );
  }

  return (
    <Section
      title="Benutzer"
      description="Mitarbeiter und Owner-Konten verwalten."
      action={
        <Button size="sm" onClick={() => setAnlegenOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Benutzer anlegen
        </Button>
      }
    >
      {benutzer.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Keine Benutzer.</p>
      ) : (
        <ul className="divide-y divide-border">
          {benutzer.map((b) => {
            const istSelbst = b.id === user?.id;
            const inaktiv = b.aktiv === 0;
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {b.username}
                    {istSelbst && (
                      <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Sie
                      </span>
                    )}
                    {inaktiv && (
                      <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        deaktiviert
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.recoveryGesetzt ? "Recovery-Code aktiv" : "Kein Recovery-Code"}
                    {b.letzteAktivitaet
                      ? ` · zuletzt aktiv ${new Date(b.letzteAktivitaet).toLocaleString("de-DE")}`
                      : ""}
                  </p>
                </div>
                <Select
                  value={b.rolle}
                  onValueChange={(v) => handleRolle(b, v as BenutzerRolle)}
                  disabled={inaktiv}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReset(b)}
                  title="Passwort zurücksetzen"
                >
                  <KeyRound className="mr-1.5 h-4 w-4" /> Reset
                </Button>
                {!istSelbst && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAktiv(b, inaktiv)}
                    title={inaktiv ? "Aktivieren" : "Deaktivieren"}
                  >
                    {inaktiv ? (
                      <>
                        <ShieldCheck className="mr-1.5 h-4 w-4" /> Aktivieren
                      </>
                    ) : (
                      <>
                        <ShieldOff className="mr-1.5 h-4 w-4" /> Deaktivieren
                      </>
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AnlegenDialog
        open={anlegenOpen}
        onOpenChange={setAnlegenOpen}
        onCreated={setGeheimnis}
      />
      <GeheimnisDialog data={geheimnis} onClose={() => setGeheimnis(null)} />
      {dialog}
    </Section>
  );
}
