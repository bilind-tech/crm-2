import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSearch } from "@/hooks/useApi";
import { Building2, FileText, FolderClosed, Receipt, StickyNote, Users } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  kunde: Users,
  objekt: Building2,
  angebot: FileText,
  rechnung: Receipt,
  dokument: FolderClosed,
  notiz: StickyNote,
};

const GROUP_LABEL: Record<string, string> = {
  kunde: "Kunden",
  objekt: "Objekte",
  angebot: "Angebote",
  rechnung: "Rechnungen",
  dokument: "Dokumente",
  notiz: "Notizen",
};

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data = [] } = useSearch(q);

  // Cmd/Ctrl+K
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);

  const grouped = data.reduce<Record<string, typeof data>>((acc, t) => {
    (acc[t.typ] ??= []).push(t);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Suche überall …" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{q ? "Nichts gefunden." : "Tippe zum Suchen …"}</CommandEmpty>
        {Object.entries(grouped).map(([typ, items]) => {
          const Icon = ICONS[typ] ?? FileText;
          return (
            <CommandGroup key={typ} heading={GROUP_LABEL[typ] ?? typ}>
              {items.map((t) => (
                <CommandItem
                  key={`${t.typ}-${t.id}`}
                  value={`${t.typ}-${t.id}-${t.titel}`}
                  onSelect={() => {
                    onOpenChange(false);
                    setQ("");
                    const route = t.link.route as "/kunden/$id" | "/objekte/$id" | "/angebote/$id" | "/rechnungen/$id" | "/dokumente";
                    navigate({ to: route, params: t.link.params as never });
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{t.titel}</span>
                    {t.untertitel && <span className="text-xs text-muted-foreground">{t.untertitel}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
