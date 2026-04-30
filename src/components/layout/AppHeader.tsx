import { useState } from "react";
import { Bell, Lock as LockIcon, Plus, Search } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import {
  useBenachrichtigungen,
  useMarkAlleBenachrichtigungenGelesen,
  useMarkBenachrichtigungGelesen,
} from "@/hooks/useApi";
import { formatDateTime } from "@/lib/format";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { QuickCreate } from "@/components/layout/QuickCreate";

export function AppHeader() {
  const { lock } = useAuth();
  const navigate = useNavigate();
  const { data: benachrichtigungen = [] } = useBenachrichtigungen();
  const ungelesen = benachrichtigungen.filter((b) => !b.gelesen).length;
  const markRead = useMarkBenachrichtigungGelesen();
  const markAllRead = useMarkAlleBenachrichtigungenGelesen();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <SidebarTrigger className="md:hidden" />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSearchOpen(true)}
        className="hidden h-9 w-72 justify-start gap-2 text-muted-foreground sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Suchen … Kunden, Objekte, Belege</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <Button variant="outline" size="icon" onClick={() => setSearchOpen(true)} className="sm:hidden h-9 w-9">
        <Search className="h-4 w-4" />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Neu</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {ungelesen > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                  {ungelesen}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b p-3">
              <p className="text-sm font-semibold">Benachrichtigungen</p>
              {ungelesen > 0 && (
                <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
                  Alle gelesen
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-80">
              {benachrichtigungen.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Keine Benachrichtigungen</p>
              )}
              {benachrichtigungen.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    if (!b.gelesen) markRead.mutate(b.id);
                    if (b.link) {
                      const route = b.link.route as "/rechnungen/$id" | "/angebote/$id" | "/kunden/$id" | "/objekte/$id";
                      navigate({ to: route, params: b.link.params as never });
                    }
                  }}
                  className={`block w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-accent ${
                    b.gelesen ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        b.typ === "warnung"
                          ? "bg-warning"
                          : b.typ === "fehler"
                          ? "bg-destructive"
                          : b.typ === "erfolg"
                          ? "bg-success"
                          : "bg-primary"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{b.titel}</p>
                      <p className="text-muted-foreground">{b.text}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(b.zeitpunkt)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" onClick={() => void lock()} title="Sperren">
          <LockIcon className="h-4 w-4" />
        </Button>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <QuickCreate open={createOpen} onOpenChange={setCreateOpen} />
    </header>
  );
}
