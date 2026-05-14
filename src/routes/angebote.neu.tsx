import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AngebotForm } from "@/components/forms/AngebotForm";
import { FormErrorBoundary } from "@/components/layout/FormErrorBoundary";
export const Route = createFileRoute("/angebote/neu")({ component: Page });
function Page() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Neues Angebot</h1>
      <FormErrorBoundary onReset={() => navigate({ to: "/angebote" })}>
        <AngebotForm onClose={() => navigate({ to: "/angebote" })} />
      </FormErrorBoundary>
    </div>
  );
}
