import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RechnungForm } from "@/components/forms/RechnungForm";
import { FormErrorBoundary } from "@/components/layout/FormErrorBoundary";
export const Route = createFileRoute("/rechnungen/neu")({ component: Page });
function Page() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Neue Rechnung</h1>
      <FormErrorBoundary onReset={() => navigate({ to: "/rechnungen" })}>
        <RechnungForm onClose={() => navigate({ to: "/rechnungen" })} />
      </FormErrorBoundary>
    </div>
  );
}
