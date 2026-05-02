import { createFileRoute } from "@tanstack/react-router";
import { useAngebot, useKunde, useFirmendaten } from "@/hooks/useApi";
import { DetailSkeleton } from "@/components/layout/DetailSkeleton";
import { NotFoundState } from "@/components/layout/NotFoundState";
import { PdfEditorLayout } from "@/components/pdf-editor/PdfEditorLayout";

export const Route = createFileRoute("/angebote/$id/bearbeiten")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { data: angebot, isLoading } = useAngebot(id);
  const { data: kunde } = useKunde(angebot?.kundeId ?? "");
  const { data: firma } = useFirmendaten();
  const ansprechpartner = kunde?.ansprechpartner?.find((a) => a.id === angebot?.ansprechpartnerId);

  if (isLoading || !angebot || !kunde || !firma) {
    if (!isLoading && !angebot) {
      return (
        <NotFoundState
          title="Angebot nicht gefunden"
          description="Dieses Angebot wurde gelöscht oder die Adresse ist ungültig."
          backTo="/angebote"
          backLabel="Zurück zu den Angeboten"
        />
      );
    }
    return <DetailSkeleton variant="beleg" />;
  }

  return (
    <PdfEditorLayout
      kind="angebot"
      beleg={angebot}
      kunde={kunde}
      firma={firma}
      ansprechpartner={ansprechpartner}
      backTo={{ to: "/angebote/$id", params: { id } }}
    />
  );
}
