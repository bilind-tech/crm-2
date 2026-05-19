import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RechnungenExcelExportDialog } from "@/components/rechnungen/RechnungenExcelExportDialog";

export function ExportTab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-semibold">Rechnungen als Excel exportieren</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Lade eine Excel-Datei mit allen Rechnungen herunter — nach Jahren gruppiert,
          mit Kunde, Beträgen, Status und Notizen, farblich markiert.
        </p>
      </div>
      <Button variant="outline" className="rounded-lg" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="mr-1.5 h-4 w-4" />
        Excel-Export starten
      </Button>
      <RechnungenExcelExportDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
