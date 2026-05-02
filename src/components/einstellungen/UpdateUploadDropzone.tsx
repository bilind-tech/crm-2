// Drag & Drop für ZIP-Update-Dateien.
import { useRef, useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".zip";
const MAX_BYTES = 200 * 1024 * 1024;

export function UpdateUploadDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Datei größer als 200 MB.");
      return;
    }
    if (!/\.zip$/i.test(file.name)) {
      setError("Erwartet wird eine .zip-Datei.");
      return;
    }
    onFile(file);
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handle(f);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 transition",
          hover ? "border-primary bg-primary/5" : "border-border bg-muted/20",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <Package className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Update-Paket hier ablegen</p>
        <p className="text-xs text-muted-foreground">
          oder klicken zum Auswählen · .zip · max 200 MB
        </p>
        <input
          ref={ref}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = "";
          }}
        />
      </button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
