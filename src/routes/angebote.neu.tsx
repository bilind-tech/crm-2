import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AngebotForm } from "@/components/forms/AngebotForm";
export const Route = createFileRoute("/angebote/neu")({ component: Page });
function Page() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Neues Angebot</h1>
      <AngebotForm onClose={() => navigate({ to: "/angebote" })} />
    </div>
  );
}
