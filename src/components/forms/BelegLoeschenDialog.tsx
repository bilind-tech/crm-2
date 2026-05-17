// Gemeinsamer Lösch-Dialog für Angebote und Rechnungen.
// Stufe 1: einfache Bestätigung — Entwürfe werden hart, andere weich gelöscht (archiviert).
// Stufe 2 (nur Status ≠ Entwurf): rote Warnung + Checkbox „Endgültig löschen", aktiviert Force-Delete.

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useDeleteAngebot, useDeleteRechnung } from "@/hooks/useApi";

interface Props {
  art: "angebot" | "rechnung";
  id: string;
  nummer: string;
  /** Aktueller Status — wenn nicht "entwurf", wird die Force-Stufe angeboten. */
  status: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (mode: "soft" | "hard") => void;
}

export function BelegLoeschenDialog({
  art,
  id,
  nummer,
  status,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const istEntwurf = status === "entwurf";
  const [force, setForce] = useState(false);
  const delAngebot = useDeleteAngebot();
  const delRechnung = useDeleteRechnung();
  const isPending = delAngebot.isPending || delRechnung.isPending;

  function handleOpenChange(o: boolean) {
    if (!o) setForce(false);
    onOpenChange(o);
  }

  function handleDelete() {
    const mutation = art === "angebot" ? delAngebot : delRechnung;
    mutation.mutate(
      { id, force: !istEntwurf && force },
      {
        onSuccess: (_data: unknown) => {
          const mode = istEntwurf || force ? "hard" : "soft";
          toast.success(
            mode === "hard"
              ? `${art === "angebot" ? "Angebot" : "Rechnung"} ${nummer} gelöscht`
              : `${art === "angebot" ? "Angebot" : "Rechnung"} ${nummer} archiviert`,
          );
          handleOpenChange(false);
          onDeleted?.(mode);
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen"),
      },
    );
  }

  const label = art === "angebot" ? "Angebot" : "Rechnung";
  const canDelete = istEntwurf || force;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {label} löschen
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-foreground">{nummer}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {istEntwurf ? (
            <p className="text-sm text-muted-foreground">
              Dieser Entwurf wird vollständig entfernt. Diese Aktion kann nicht rückgängig gemacht
              werden.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="mb-2 font-medium text-foreground">
                  Dieses {label.toLowerCase()} wurde bereits versendet bzw. ist nicht mehr im
                  Entwurfsstatus.
                </p>
                <p className="text-muted-foreground">
                  Standardmäßig wird es nur archiviert. Mit „Endgültig löschen" werden auch
                  Zahlungen, Mahn-Einträge und die E-Mail-Historie unwiderruflich entfernt.
                </p>
              </div>
              <Label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={force}
                  onCheckedChange={(v) => setForce(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Endgültig löschen inkl. aller Zahlungen, Mahnungen und E-Mail-Historie
                </span>
              </Label>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              variant={canDelete ? "destructive" : "secondary"}
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending
                ? "Lösche…"
                : canDelete
                  ? "Endgültig löschen"
                  : "Archivieren"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}