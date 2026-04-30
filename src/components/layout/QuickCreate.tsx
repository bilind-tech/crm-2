import { useNavigate } from "@tanstack/react-router";
import { Building2, FileText, FolderClosed, Receipt, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

const ITEMS = [
  { label: "Kunde", route: "/kunden/neu", icon: Users, desc: "Neuen Kunden anlegen" },
  { label: "Objekt", route: "/objekte/neu", icon: Building2, desc: "Neues Objekt anlegen" },
  { label: "Angebot", route: "/angebote/neu", icon: FileText, desc: "Neues Angebot erstellen" },
  { label: "Rechnung", route: "/rechnungen/neu", icon: Receipt, desc: "Neue Rechnung erstellen" },
  { label: "Dokument", route: "/dokumente", icon: FolderClosed, desc: "Datei hochladen" },
] as const;

export function QuickCreate({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schnell anlegen</DialogTitle>
          <DialogDescription>Was möchtest du erstellen?</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ITEMS.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                onOpenChange(false);
                navigate({ to: it.route });
              }}
              className="text-left"
            >
              <Card className="h-full p-4 transition hover:border-primary hover:shadow-md">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <it.icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">{it.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p>
              </Card>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
