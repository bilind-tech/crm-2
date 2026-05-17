import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database, Search, Table as TableIcon, LayoutGrid, RotateCcw, Trash2,
  Printer, ExternalLink, Download, Save, X, FileText, AlertTriangle, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { api } from "@/lib/api/client";
import { getBackendUrl } from "@/lib/api/backendUrl";
import { errorToMessage } from "@/lib/api/piClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/einstellungen/datenbank")({
  component: DatenbankPage,
});

type ListColumn = { column: string; label: string; type?: string };
type FieldDef = { column: string; label: string; type: "text" | "longtext" | "number" | "boolean" | "date" | "datetime" };
type Tabelle = {
  key: string; label: string; icon: string | null; sqlTable: string;
  total: number; aktiv: number; geloescht: number; hasGeloeschtAm: boolean;
  listColumns: ListColumn[]; searchColumns: string[];
  kundeColumn: string | null; dateColumn: string | null;
  hasPdf: boolean; editable: FieldDef[];
};
type Row = Record<string, unknown> & { id: string; geloescht_am?: string | null };

function DatenbankPage() {
  const [tabelle, setTabelle] = useState<string>("kunde");
  const [view, setView] = useState<"tabelle" | "karten">("tabelle");
  const [status, setStatus] = useState<"aktiv" | "alle" | "geloescht">("aktiv");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const tabellenQ = useQuery({
    queryKey: ["datenbank", "tabellen"],
    queryFn: () => api.get<Tabelle[]>("/datenbank/tabellen"),
  });

  const aktive = tabellenQ.data?.find((t) => t.key === tabelle) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Datenbank" subtitle="Alles, was im System gespeichert ist — inklusive gelöschter Einträge" />

      <div className="grid grid-cols-[260px_1fr] gap-6">
        <DbSidebar
          tabellen={tabellenQ.data ?? []}
          loading={tabellenQ.isLoading}
          aktiv={tabelle}
          onSelect={(k) => { setTabelle(k); setDetailId(null); setSearch(""); }}
        />

        <div className="space-y-4">
          {aktive ? (
            <DbContent
              tabelle={aktive}
              view={view} setView={setView}
              status={status} setStatus={setStatus}
              search={search} setSearch={setSearch}
              onOpen={setDetailId}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              <Database className="mx-auto h-8 w-8 opacity-50" />
              <p className="mt-3">Tabelle wählen</p>
            </div>
          )}
        </div>
      </div>

      {aktive && detailId && (
        <DetailSheet
          tabelle={aktive}
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

function DbSidebar({
  tabellen, loading, aktiv, onSelect,
}: { tabellen: Tabelle[]; loading: boolean; aktiv: string; onSelect: (k: string) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-2">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tabellen</div>
      {loading && <div className="px-3 py-4 text-sm text-muted-foreground">Lade…</div>}
      <div className="space-y-0.5">
        {tabellen.map((t) => (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent/40",
              aktiv === t.key && "bg-accent/60 font-medium",
            )}
          >
            <span className="truncate">{t.label}</span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>{t.aktiv}</span>
              {t.geloescht > 0 && <span className="text-destructive">+{t.geloescht}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DbContent({
  tabelle, view, setView, status, setStatus, search, setSearch, onOpen,
}: {
  tabelle: Tabelle;
  view: "tabelle" | "karten"; setView: (v: "tabelle" | "karten") => void;
  status: "aktiv" | "alle" | "geloescht"; setStatus: (s: "aktiv" | "alle" | "geloescht") => void;
  search: string; setSearch: (s: string) => void;
  onOpen: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [tabelle.key, status, search]);

  const listQ = useQuery({
    queryKey: ["datenbank", "list", tabelle.key, status, search, page],
    queryFn: () =>
      api.get<{ total: number; page: number; limit: number; rows: Row[] }>(
        `/datenbank/${tabelle.key}?status=${status}&q=${encodeURIComponent(search)}&page=${page}&limit=50`,
      ),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`In ${tabelle.label.toLowerCase()} suchen…`}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktiv">Nur aktive ({tabelle.aktiv})</SelectItem>
            <SelectItem value="alle">Alle ({tabelle.total})</SelectItem>
            <SelectItem value="geloescht" disabled={!tabelle.hasGeloeschtAm}>
              Nur gelöschte ({tabelle.geloescht})
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-border bg-background p-0.5">
          <Button variant={view === "tabelle" ? "secondary" : "ghost"} size="sm" onClick={() => setView("tabelle")}>
            <TableIcon className="h-4 w-4" />
          </Button>
          <Button variant={view === "karten" ? "secondary" : "ghost"} size="sm" onClick={() => setView("karten")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {listQ.isLoading && (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      )}
      {listQ.isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorToMessage(listQ.error)}
        </div>
      )}
      {listQ.data && (
        <>
          {view === "tabelle" ? (
            <TableView tabelle={tabelle} rows={listQ.data.rows} onOpen={onOpen} />
          ) : (
            <CardsView tabelle={tabelle} rows={listQ.data.rows} onOpen={onOpen} />
          )}
          <Pagination
            page={page} total={listQ.data.total} limit={listQ.data.limit}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}

function formatCell(v: unknown, type?: string): string {
  if (v == null || v === "") return "—";
  if (type === "datetime" || type === "date") {
    const d = new Date(String(v));
    if (!isNaN(d.getTime())) return d.toLocaleString("de-DE");
  }
  if (type === "number") return Number(v).toLocaleString("de-DE");
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

function TableView({ tabelle, rows, onOpen }: { tabelle: Tabelle; rows: Row[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Keine Einträge.</div>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {tabelle.listColumns.map((c) => <TableHead key={c.column}>{c.label}</TableHead>)}
            <TableHead className="w-[100px] text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isDeleted = !!r.geloescht_am;
            return (
              <TableRow
                key={r.id}
                onClick={() => onOpen(r.id)}
                className={cn("cursor-pointer hover:bg-accent/30", isDeleted && "opacity-60")}
              >
                {tabelle.listColumns.map((c) => (
                  <TableCell key={c.column} className={cn(isDeleted && "line-through")}>
                    {formatCell(r[c.column], c.type)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {isDeleted
                    ? <Badge variant="destructive">gelöscht</Badge>
                    : <Badge variant="secondary">aktiv</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CardsView({ tabelle, rows, onOpen }: { tabelle: Tabelle; rows: Row[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Keine Einträge.</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => {
        const isDeleted = !!r.geloescht_am;
        const [first, ...rest] = tabelle.listColumns;
        return (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            className={cn(
              "rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm",
              isDeleted && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={cn("font-medium", isDeleted && "line-through")}>
                {formatCell(r[first.column], first.type)}
              </div>
              {isDeleted
                ? <Badge variant="destructive">gelöscht</Badge>
                : <Badge variant="secondary">aktiv</Badge>}
            </div>
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              {rest.map((c) => (
                <div key={c.column} className="flex justify-between gap-2">
                  <dt>{c.label}</dt>
                  <dd className="truncate text-foreground">{formatCell(r[c.column], c.type)}</dd>
                </div>
              ))}
            </dl>
          </button>
        );
      })}
    </div>
  );
}

function Pagination({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{total.toLocaleString("de-DE")} Einträge</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Zurück</Button>
        <span>{page} / {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Weiter</Button>
      </div>
    </div>
  );
}

function DetailSheet({ tabelle, id, onClose }: { tabelle: Tabelle; id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detailQ = useQuery({
    queryKey: ["datenbank", "detail", tabelle.key, id],
    queryFn: () => api.get<Row>(`/datenbank/${tabelle.key}/${id}`),
  });
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [hartOpen, setHartOpen] = useState(false);

  useEffect(() => { setEdits({}); }, [id]);

  const save = useMutation({
    mutationFn: () => api.patch<Row>(`/datenbank/${tabelle.key}/${id}`, edits),
    onSuccess: () => {
      toast.success("Gespeichert");
      setEdits({});
      void qc.invalidateQueries({ queryKey: ["datenbank"] });
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const restore = useMutation({
    mutationFn: () => api.post(`/datenbank/${tabelle.key}/${id}/restore`),
    onSuccess: () => {
      toast.success("Wiederhergestellt");
      void qc.invalidateQueries({ queryKey: ["datenbank"] });
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const row = detailQ.data;
  const isDeleted = !!row?.geloescht_am;

  const pdfUrl = useMemo(
    () => (tabelle.hasPdf ? `${getBackendUrl()}/datenbank/${tabelle.key}/${id}/pdf` : null),
    [tabelle, id],
  );

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {tabelle.label} <span className="font-mono text-xs text-muted-foreground">#{id.slice(0, 8)}</span>
            {isDeleted && <Badge variant="destructive">gelöscht</Badge>}
          </SheetTitle>
          <SheetDescription>Felder bearbeiten, PDF ansehen oder den Eintrag verwalten.</SheetDescription>
        </SheetHeader>

        {detailQ.isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
        {detailQ.isError && <div className="text-sm text-destructive">{errorToMessage(detailQ.error)}</div>}

        {row && (
          <div className="mt-4 space-y-6">
            {/* Aktionen */}
            <div className="flex flex-wrap gap-2">
              {isDeleted && (
                <Button size="sm" onClick={() => restore.mutate()} disabled={restore.isPending}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Wiederherstellen
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => setHartOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Hart löschen
              </Button>
              {pdfUrl && (
                <>
                  <Button size="sm" variant="outline" asChild>
                    <a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Neuer Tab</a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printPdf(pdfUrl)}>
                    <Printer className="mr-2 h-4 w-4" /> Drucken
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={pdfUrl} download><Download className="mr-2 h-4 w-4" />Download</a>
                  </Button>
                </>
              )}
            </div>

            {/* PDF Vorschau */}
            {pdfUrl && (
              <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <object data={pdfUrl} type="application/pdf" className="h-[500px] w-full">
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <FileText className="mx-auto h-6 w-6" />
                    <p className="mt-2">PDF kann nicht eingebettet werden — bitte im neuen Tab öffnen.</p>
                  </div>
                </object>
              </div>
            )}

            {/* Bearbeitbare Felder */}
            {tabelle.editable.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Bearbeiten</h3>
                {tabelle.editable.map((f) => {
                  const current = (edits[f.column] ?? row[f.column] ?? "") as string | number;
                  return (
                    <div key={f.column} className="grid grid-cols-[180px_1fr] items-start gap-3">
                      <label className="pt-2 text-sm text-muted-foreground">{f.label}</label>
                      {f.type === "longtext" ? (
                        <textarea
                          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={String(current)}
                          onChange={(e) => setEdits((p) => ({ ...p, [f.column]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                          value={String(current)}
                          onChange={(e) => setEdits((p) => ({ ...p, [f.column]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEdits({})} disabled={Object.keys(edits).length === 0}>
                    <X className="mr-2 h-4 w-4" /> Verwerfen
                  </Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending || Object.keys(edits).length === 0}>
                    <Save className="mr-2 h-4 w-4" /> Speichern
                  </Button>
                </div>
              </div>
            )}

            {/* Alle Rohdaten */}
            <details className="rounded-xl border border-border bg-muted/20 p-3 text-xs">
              <summary className="cursor-pointer text-sm font-medium">Alle Felder ({Object.keys(row).length})</summary>
              <dl className="mt-3 grid grid-cols-[200px_1fr] gap-x-3 gap-y-1 font-mono">
                {Object.entries(row).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="truncate text-muted-foreground">{k}</dt>
                    <dd className="break-all">{v == null ? "null" : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        )}

        <HartLoeschenDialog
          open={hartOpen}
          onOpenChange={setHartOpen}
          tabelle={tabelle}
          id={id}
          onDone={() => { setHartOpen(false); onClose(); void qc.invalidateQueries({ queryKey: ["datenbank"] }); }}
        />
      </SheetContent>
    </Sheet>
  );
}

function HartLoeschenDialog({
  open, onOpenChange, tabelle, id, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; tabelle: Tabelle; id: string; onDone: () => void }) {
  const [passwort, setPasswort] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setPasswort(""); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  async function go() {
    if (!passwort) return;
    setLoading(true);
    try {
      await api.post(`/datenbank/${tabelle.key}/${id}/hart-loeschen`, { passwort });
      toast.success("Eintrag endgültig gelöscht");
      onDone();
    } catch (e) {
      toast.error(errorToMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Hart löschen
          </AlertDialogTitle>
          <AlertDialogDescription>
            Dieser Eintrag wird endgültig aus der Datenbank entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            Bitte zur Bestätigung dein Passwort eingeben.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          ref={inputRef}
          type="password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          placeholder="Passwort"
          onKeyDown={(e) => { if (e.key === "Enter") void go(); }}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void go(); }}
            disabled={loading || !passwort}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function printPdf(url: string) {
  const w = window.open(url, "_blank");
  if (!w) { toast.error("Bitte Popups erlauben."); return; }
  w.addEventListener("load", () => { try { w.print(); } catch { /* ignore */ } });
}