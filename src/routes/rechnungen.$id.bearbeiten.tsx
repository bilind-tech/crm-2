import { createFileRoute } from "@tanstack/react-router";
import { useRechnung, useKunde, useFirmendaten } from "@/hooks/useApi";
import { DetailSkeleton } from "@/components/layout/DetailSkeleton";
import { NotFoundState } from "@/components/layout/NotFoundState";
import { PdfEditorLayout } from "@/components/pdf-editor/PdfEditorLayout";

export const Route = createFileRoute("/rechnungen/$id/bearbeiten")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { data: rechnung, isLoading } = useRechnung(id);
  const { data: kunde } = useKunde(rechnung?.kundeId ?? "");
  const { data: firma } = useFirmendaten();
  const ansprechpartner = kunde?.ansprechpartner?.find((a) => a.id === rechnung?.ansprechpartnerId);

  if (isLoading || !rechnung || !kunde || !firma) {
    if (!isLoading && !rechnung) {
      return (
        <NotFoundState
          title="Rechnung nicht gefunden"
          description="Diese Rechnung wurde gelöscht oder die Adresse ist ungültig."
          backTo="/rechnungen"
          backLabel="Zurück zu den Rechnungen"
        />
      );
    }
    return <DetailSkeleton variant="beleg" />;
  }

  return (
    <PdfEditorLayout
      kind="rechnung"
      beleg={rechnung}
      kunde={kunde}
      firma={firma}
      ansprechpartner={ansprechpartner}
      backTo={{ to: "/rechnungen/$id", params: { id } }}
    />
  );
}
