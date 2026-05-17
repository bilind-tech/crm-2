// Dialog zum Hochladen / Entfernen eines Kunden-Logos.
// Accept: PNG, JPG, WebP, SVG — max 2 MB (Backend prüft hart).

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUploadKundeLogo, useDeleteKundeLogo, kundeLogoUrl } from "@/hooks/useApi";
import { errorToMessage } from "@/lib/api/piClient";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

interface Props {
  kundeId: string;
  hasLogo: boolean;
  logoUpdatedAt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KundeLogoUploadDialog({
  kundeId,
  hasLogo,
  logoUpdatedAt,
  open,
  onOpenChange,
}: Props) {
  const upload = useUploadKundeLogo(kundeId);
  const del = useDeleteKundeLogo(kundeId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function pickFile(f: File | null) {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) {
      toast.error("Nur PNG, JPG, WebP oder SVG.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Datei zu groß — max. 2 MB.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function handleUpload() {
    if (!pendingFile) return;
    upload.mutate(pendingFile, {
      onSuccess: () => {
        toast.success("Logo gespeichert");
        reset();
        onOpenChange(false);
      },
      onError: (e) => toast.error(errorToMessage(e, "Upload fehlgeschlagen")),
    });
  }

  function handleDelete() {
    del.mutate(undefined, {
      onSuccess: () => {
        toast.success("Logo entfernt");
        reset();
        onOpenChange(false);
      },
      onError: (e) => toast.error(errorToMessage(e, "Entfernen fehlgeschlagen")),
    });
  }

  const showPreview = previewUrl ?? (hasLogo ? kundeLogoUrl(kundeId, logoUpdatedAt) : null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Kunden-Logo
          </DialogTitle>
          <DialogDescription>
            Wird in der Kundenliste, im Detail-Header und auf PDFs angezeigt. PNG, JPG, WebP oder
            SVG, max. 2 MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid h-40 place-content-center rounded-2xl border border-dashed border-border bg-muted/30 p-3">
            {showPreview ? (
              <img
                src={showPreview}
                alt="Logo-Vorschau"
                className="max-h-32 max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Noch kein Logo hinterlegt.</p>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-1.5 rounded-full"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Datei wählen
            </Button>
            {hasLogo && !pendingFile && (
              <Button
                variant="outline"
                className="gap-1.5 rounded-full text-destructive hover:text-destructive"
                disabled={del.isPending}
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                {del.isPending ? "Entferne…" : "Logo entfernen"}
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Schließen
            </Button>
            <Button
              disabled={!pendingFile || upload.isPending}
              onClick={handleUpload}
            >
              {upload.isPending ? "Lade hoch…" : "Hochladen"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}