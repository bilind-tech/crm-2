import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ObjektForm } from "@/components/forms/ObjektForm";
export const Route = createFileRoute("/objekte/neu")({ component: Page });
function Page() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Neues Objekt</h1>
      <ObjektForm onClose={() => navigate({ to: "/objekte" })} />
    </div>
  );
}
