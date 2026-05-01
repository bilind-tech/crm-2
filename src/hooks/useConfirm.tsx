import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

interface PendingConfirm extends ConfirmOptions {
  onConfirm: () => void;
}

/**
 * Imperatives Pattern für Bestätigungen. Ersetzt window.confirm().
 *
 * Beispiel:
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   <button onClick={() => confirm({
 *     title: "Wirklich löschen?",
 *     description: `Rechnung ${nr} dauerhaft entfernen.`,
 *     variant: "destructive",
 *     confirmLabel: "Löschen",
 *   }, () => del.mutate(id))} />
 *   ...
 *   {dialog}
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions, onConfirm: () => void) => {
    setPending({ ...opts, onConfirm });
  }, []);

  const handleConfirm = () => {
    pending?.onConfirm();
    setPending(null);
  };

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => !o && setPending(null)}
      title={pending?.title ?? ""}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      variant={pending?.variant}
      onConfirm={handleConfirm}
    />
  );

  return { confirm, dialog };
}
