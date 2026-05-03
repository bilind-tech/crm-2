// Detail-Ansicht eines Protokolls (read-only) — mit eingebetteter PDF wenn abgeschlossen.
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotFoundState } from "@/components/layout/NotFoundState";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useAbschliessenProtokoll, useDeleteProtokoll, useFirmendaten, useKunde, useObjekte, useProtokoll,
} from "@/hooks/useApi";
import { downloadBlob, generateProtokollPdf, protokollDateiname, protokollTitel } from "@/lib/pdf/werkzeugePdf";
import { blobToDataUrl } from "@/lib/dokumente/blobToDataUrl";

export const Route = createFileRoute("/protokolle/$id")({ component: Page });

function Page() {
  const router = useRouter();
  const { id } = Route.useParams();
  const protokollQ = useProtokoll(id);
  const p = protokollQ.data;
  const kundeQ = useKunde(p?.kundeId ?? "");
  const objekteQ = useObjekte(p?.kundeId);
  const firmaQ = useFirmendaten();
  const abschliessen = useAbschliessenProtokoll(id);
  const del = useDeleteProtokoll();
  const [busy, setBusy] = useState(false);
  const objekt = p?.objektId ? objekteQ.data?.find((o) => o.id === p.objektId) : undefined;

  if (protokollQ.isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Lade …</div>;
  }
  if (!p) {
    return <NotFoundState title="Protokoll nicht gefunden" description="Dieses Protokoll wurde gelöscht oder die Adresse ist ungültig." backTo="/protokolle" backLabel="Zurück zu Protokollen" />;
  }

  const onDownload = async () => {
    setBusy(true);
    try {
      const blob = await generateProtokollPdf(p, kundeQ.data, objekt, firmaQ.data);
      downloadBlob(blob, protokollDateiname(p, kundeQ.data));
    } catch (e) {
      console.error(e); toast.error("PDF-Fehler");
    } finally { setBusy(false); }
  };

  const onAbschliessen = async () => {
    setBusy(true);
    try {
      const blob = await generateProtokollPdf(p, kundeQ.data, objekt, firmaQ.data);
      const dateiname = protokollDateiname(p, kundeQ.data);
      const url = await blobToDataUrl(blob);
      await abschliessen.mutateAsync({ dateiname, mimeType: "application/pdf", groesseBytes: blob.size, url });
      toast.success("Abgeschlossen — in Dokumenten gespeichert");
    } catch (e) {
      console.error(e); toast.error("Konnte nicht abschließen");
    } finally { setBusy(false); }
  };

  const onDelete = async () => {
    try {
      await del.mutateAsync(id);
      toast.success("Protokoll gelöscht");
      void router.navigate({ to: "/protokolle" });
    } catch { toast.error("Löschen fehlgeschlagen"); }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={protokollTitel(p)}
        subtitle={<span className="font-mono">{p.nummer}</span>}
        actions={
          <Button variant="ghost" size="sm" asChild><Link to="/protokolle"><ArrowLeft className="mr-1.5 h-4 w-4" />Zurück</Link></Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Status" value={<span className="capitalize">{p.status}</span>} />
        <InfoCard label="Datum / Uhrzeit" value={`${p.datum} · ${p.uhrzeit}`} />
        <InfoCard label="Kunde" value={kundeQ.data ? (kundeQ.data.firmenname || [kundeQ.data.vorname, kundeQ.data.nachname].filter(Boolean).join(" ")) : "—"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/protokolle/$id/bearbeiten" params={{ id }}><Pencil className="mr-1.5 h-4 w-4" />Bearbeiten</Link>
        </Button>
        <Button variant="outline" onClick={onDownload} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}PDF herunterladen
        </Button>
        {p.status !== "abgeschlossen" && (
          <Button variant="outline" onClick={onAbschliessen} disabled={busy || !p.kundeId}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />Abschließen
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" className="text-destructive"><Trash2 className="mr-1.5 h-4 w-4" />Löschen</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Protokoll löschen?</AlertDialogTitle>
              <AlertDialogDescription>Dies kann nicht rückgängig gemacht werden.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Löschen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {p.status === "abgeschlossen" && p.dokumentId ? (
        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          Diese Version ist im Bereich „Dokumente" archiviert.{" "}
          <Link to="/dokumente" className="text-primary underline">Zu den Dokumenten</Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Entwurf — noch nicht abgeschlossen.
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
