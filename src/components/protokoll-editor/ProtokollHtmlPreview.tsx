// HTML-Live-Vorschau für Protokolle.
//
// Spiegelt das PDF aus `werkzeugePdf.ts` visuell — aber als reines React-DOM.
// Damit gibt es technisch kein Flackern: jede Änderung am Draft fließt direkt
// in den HTML-Baum, ohne PDF.js, Canvas oder Blob-Swap.
//
// Click-to-Edit: jede Sektion ist ein Popover-Trigger, der den bestehenden
// `ProtokollHotspotEditor` mit derselben fieldId öffnet. So bleibt die ganze
// Edit-Logik unverändert.
//
// Die echte PDF wird nur noch beim Drucken / Senden / Abschließen erzeugt.

import { useMemo, useState, type ReactNode } from "react";
import logoFallback from "@/assets/logo.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  Protokoll,
  Kunde,
  Objekt,
  Firmendaten,
  UebergabeProtokoll,
  SchluesselProtokoll,
  ProtokollOptionen,
} from "@/lib/api/types";

interface Props {
  draft: Protokoll;
  kunde?: Kunde;
  objekt?: Objekt;
  firma?: Firmendaten;
  /** Render-Prop: liefert den Inline-Editor für eine fieldId (genau wie LivePdfPreview). */
  renderEditor?: (fieldId: string, close: () => void) => ReactNode;
}

// ───────── Helpers (1:1 zu werkzeugePdf.ts) ──────────────────────────────

function kundeName(k?: Kunde): string {
  if (!k) return "—";
  if (k.typ === "firma" && k.firmenname) return k.firmenname;
  return [k.vorname, k.nachname].filter(Boolean).join(" ") || k.nummer;
}

function kundeAdresse(k: Kunde, o?: Objekt): string[] {
  const lines: string[] = [];
  if (k.firmenname) lines.push(k.firmenname);
  const person = [k.vorname, k.nachname].filter(Boolean).join(" ");
  if (person) lines.push(person);
  if (o) {
    if (o.name) lines.push(`Objekt: ${o.name}`);
    if (o.strasse) lines.push(o.strasse);
    const plzOrt = [o.plz, o.ort].filter(Boolean).join(" ");
    if (plzOrt) lines.push(plzOrt);
  } else {
    if (k.strasse) lines.push(k.strasse);
    const plzOrt = [k.plz, k.ort].filter(Boolean).join(" ");
    if (plzOrt) lines.push(plzOrt);
  }
  return lines;
}

function absenderzeile(f?: Firmendaten): string {
  if (!f) return "";
  const teile = [f.firmenname, f.strasse, `${f.plz ?? ""} ${f.ort ?? ""}`.trim()].filter(Boolean);
  return teile.join(" – ");
}

function formatDatum(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

const UEBERGABE_TITEL: Record<UebergabeProtokoll["art"], string> = {
  uebergabe: "Übergabeprotokoll",
  abnahme: "Abnahmeprotokoll",
  beides: "Übergabe- und Abnahmeprotokoll",
};

function defaultTitel(draft: Protokoll): string {
  if (draft.kind === "schluessel") {
    return draft.richtung === "ausgabe"
      ? "Schlüsselübergabe — Ausgabe"
      : "Schlüsselübergabe — Rücknahme";
  }
  return UEBERGABE_TITEL[draft.art];
}

// ───────── Edit-Hotspot Wrapper ──────────────────────────────────────────

interface HotspotProps {
  fieldId: string;
  enabled: boolean;
  renderEditor?: Props["renderEditor"];
  className?: string;
  children: ReactNode;
}

function Hotspot({ fieldId, enabled, renderEditor, className, children }: HotspotProps) {
  const [open, setOpen] = useState(false);
  if (!enabled || !renderEditor) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          tabIndex={0}
          role="button"
          className={cn(
            "group relative cursor-text rounded-sm transition",
            "outline-none ring-0",
            "hover:bg-amber-50/60 hover:ring-1 hover:ring-amber-300/60",
            "focus-visible:bg-amber-50/60 focus-visible:ring-1 focus-visible:ring-amber-400",
            open && "bg-amber-50/80 ring-1 ring-amber-400",
            className,
          )}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={12}
        className="w-auto max-w-[min(540px,calc(100vw-32px))] p-3"
      >
        {renderEditor(fieldId, () => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

// ───────── Komponenten-Bausteine ─────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-1 mt-4 text-[10px] font-bold uppercase text-black"
      style={{ letterSpacing: "0.6px" }}
    >
      {children}
    </div>
  );
}

function ThinLine() {
  return <div className="h-px w-full bg-[#bdbdbd]" />;
}

function SectionBody({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <p
      className={cn(
        "mt-1.5 whitespace-pre-wrap text-[10px] leading-[1.35]",
        muted ? "text-[#555]" : "text-black",
      )}
    >
      {children}
    </p>
  );
}

function UnterschriftenBlock({
  linksLabel,
  linksName,
  rechtsLabel,
  rechtsName,
}: {
  linksLabel: string;
  linksName: string;
  rechtsLabel: string;
  rechtsName: string;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-6">
      {[
        { label: linksLabel, name: linksName },
        { label: rechtsLabel, name: rechtsName },
      ].map((s, i) => (
        <div key={i} className="flex flex-col">
          <div className="min-h-[28px] text-[10px] text-black">{s.name || "\u00a0"}</div>
          <div className="mt-1 h-px w-full bg-black" />
          <div className="mt-1 text-[8px] text-[#555]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ───────── Haupt-Komponente ──────────────────────────────────────────────

export function ProtokollHtmlPreview({ draft, kunde, objekt, firma, renderEditor }: Props) {
  const opt: ProtokollOptionen = draft.optionen ?? {};
  const titel = (opt.titelOverride?.trim() || defaultTitel(draft));
  const adresse = useMemo(
    () => (kunde ? kundeAdresse(kunde, objekt) : ["—"]),
    [kunde, objekt],
  );

  const meta: { label: string; wert: string }[] = [];
  if (draft.nummer)
    meta.push({
      label: draft.kind === "schluessel" ? "Beleg-Nr." : "Protokoll-Nr.",
      wert: draft.nummer,
    });
  meta.push({ label: "Datum", wert: formatDatum(draft.datum) });
  meta.push({ label: "Uhrzeit", wert: draft.uhrzeit || "—" });
  if (kunde?.nummer) meta.push({ label: "Kunden-Nr.", wert: kunde.nummer });

  const logoSrc = (firma?.logoUrl && firma.logoUrl.trim()) || logoFallback;
  const showLogo = opt.logoSichtbar !== false;
  const showFooter = opt.footerSichtbar !== false;

  const edit = !!renderEditor;

  return (
    <div className="relative h-full overflow-y-auto bg-muted/30 px-2 py-3 sm:px-4">
      {/* A4-Blatt — fixe Proportionen, skaliert via max-width */}
      <div className="mx-auto w-full max-w-[760px]">
        <div
          className="relative mx-auto bg-white shadow-sm ring-1 ring-border"
          style={{
            // A4 ~ 1 : 1.414
            aspectRatio: "595 / 842",
            // Roboto matcht den PDF-Font exakt
            fontFamily:
              'Roboto, "Helvetica Neue", Helvetica, Arial, ui-sans-serif, system-ui, sans-serif',
            // Innenabstände proportional zu pdfmake pageMargins
            // pageMargins: [55, 30, 55, 12] header // content [55, 155, 55, 100]
            paddingLeft: "9.2%", // 55/595
            paddingRight: "9.2%",
            paddingTop: "3.6%", // 30/842 (Header oben)
            paddingBottom: "1.4%", // 12/842
            color: "#000",
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="pt-12 text-[8px] underline">{absenderzeile(firma)}</div>
            {showLogo ? (
              <img
                src={logoSrc}
                alt=""
                className="max-h-[60px] w-auto object-contain"
                style={{ maxWidth: "45%" }}
                draggable={false}
              />
            ) : (
              <div className="text-[18px] font-bold uppercase">
                {(firma?.firmenname || "MY CLEAN CENTER").toUpperCase()}
              </div>
            )}
          </div>

          {/* Kunde + Meta */}
          <div className="mt-6 grid grid-cols-[1fr_235px] gap-5">
            <Hotspot fieldId="kunde" enabled={edit} renderEditor={renderEditor} className="p-1">
              <div className="text-[10px] leading-[1.35]">
                {adresse.length === 0 ? (
                  <div className="text-[#555]">—</div>
                ) : (
                  adresse.map((l, i) => (
                    <div key={i} className={i === 0 ? "font-bold" : ""}>
                      {l}
                    </div>
                  ))
                )}
              </div>
            </Hotspot>
            <Hotspot fieldId="meta" enabled={edit} renderEditor={renderEditor} className="p-1">
              <div className="border border-black">
                {meta.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-2 py-[2px] text-[9.5px]"
                  >
                    <span>{m.label}</span>
                    <span>{m.wert}</span>
                  </div>
                ))}
              </div>
            </Hotspot>
          </div>

          {/* Titel */}
          <Hotspot fieldId="titel" enabled={edit} renderEditor={renderEditor} className="mt-7 p-1">
            <div className="text-[22px] font-bold leading-tight text-black">{titel}</div>
            {opt.untertitel?.trim() && (
              <div className="mt-1 text-[11px] text-[#555]">{opt.untertitel}</div>
            )}
          </Hotspot>

          {/* Sektionen */}
          {draft.kind === "uebergabe" ? (
            <UebergabeSections draft={draft} edit={edit} renderEditor={renderEditor} />
          ) : (
            <SchluesselSections draft={draft} edit={edit} renderEditor={renderEditor} />
          )}

          {/* Zusatzklausel */}
          {opt.zusatzKlausel?.trim() && (
            <Hotspot
              fieldId="klausel"
              enabled={edit}
              renderEditor={renderEditor}
              className="mt-4 p-1"
            >
              <SectionTitle>Zusatzklausel</SectionTitle>
              <ThinLine />
              <SectionBody>{opt.zusatzKlausel}</SectionBody>
            </Hotspot>
          )}

          {/* Unterschriften */}
          <Hotspot
            fieldId="unterschriften"
            enabled={edit}
            renderEditor={renderEditor}
            className="mt-5 p-1"
          >
            {draft.kind === "uebergabe" && (
              <>
                <SectionTitle>Anwesende Personen / Unterschriften</SectionTitle>
                <ThinLine />
              </>
            )}
            <UnterschriftenBlock
              linksLabel="Unterschrift Auftraggeber"
              linksName={draft.vertreterAuftraggeber}
              rechtsLabel="Unterschrift Auftragnehmer"
              rechtsName={draft.vertreterAuftragnehmer}
            />
          </Hotspot>

          {/* Footer */}
          {showFooter && (
            <div className="absolute inset-x-[9.2%] bottom-[1.4%]">
              <div className="h-px w-full bg-[#bdbdbd]" />
              <div className="mt-2 grid grid-cols-4 gap-3 text-[7px] leading-[1.3] text-black">
                <FooterCell
                  lines={[
                    firma?.firmenname,
                    firma?.geschaeftsfuehrer
                      ? `Geschäftsführer: ${firma.geschaeftsfuehrer}`
                      : null,
                    [firma?.strasse, [firma?.plz, firma?.ort].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(" - "),
                  ]}
                />
                <FooterCell lines={["Bank", firma?.bankName, firma?.iban]} />
                <FooterCell lines={[firma?.telefon, firma?.email]} />
                <FooterCell
                  lines={[
                    firma?.handelsregister,
                    firma?.ustId ? `USt-ID: ${firma.ustId}` : null,
                    firma?.webseite,
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        {/* Hinweis-Bar — WYSIWYG-Versprechen */}
        <p className="mx-auto mt-3 max-w-[680px] text-center text-[11px] text-muted-foreground">
          Live-Vorschau · klicke auf einen Bereich zum Bearbeiten · die echte PDF wird beim Drucken
          oder Abschließen erzeugt
        </p>
      </div>
      {/* Kunde-Hinweis hilft Linter (kundeName ist als Utility ggf. nützlich) */}
      <span className="sr-only">{kundeName(kunde)}</span>
    </div>
  );
}

function FooterCell({ lines }: { lines: (string | null | undefined)[] }) {
  const visible = lines.filter(Boolean) as string[];
  if (visible.length === 0) return <div />;
  return (
    <div>
      {visible.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

// ───────── Sektionen je Protokoll-Art ────────────────────────────────────

function UebergabeSections({
  draft,
  edit,
  renderEditor,
}: {
  draft: UebergabeProtokoll;
  edit: boolean;
  renderEditor?: Props["renderEditor"];
}) {
  const opt: ProtokollOptionen = draft.optionen ?? {};
  const sekt = (k: "leistung" | "bemerkungen" | "ergebnis", fb: string) =>
    (opt.sektionsTitel?.[k] && opt.sektionsTitel[k]!.trim()) || fb;
  return (
    <>
      <Hotspot
        fieldId="leistungsumfang"
        enabled={edit}
        renderEditor={renderEditor}
        className="p-1"
      >
        <SectionTitle>{sekt("leistung", "Leistungsumfang")}</SectionTitle>
        <ThinLine />
        <SectionBody muted={!draft.leistungsumfang}>
          {draft.leistungsumfang || "—"}
        </SectionBody>
      </Hotspot>
      <Hotspot fieldId="bemerkungen" enabled={edit} renderEditor={renderEditor} className="p-1">
        <SectionTitle>{sekt("bemerkungen", "Mängel / Bemerkungen")}</SectionTitle>
        <ThinLine />
        <SectionBody muted={!draft.bemerkungen}>
          {draft.bemerkungen || "Keine."}
        </SectionBody>
      </Hotspot>
      <Hotspot fieldId="ergebnis" enabled={edit} renderEditor={renderEditor} className="p-1">
        <SectionTitle>{sekt("ergebnis", "Ergebnis")}</SectionTitle>
        <ThinLine />
        <SectionBody>
          {draft.ohneVorbehalt
            ? "Die Leistung wird ohne Vorbehalt abgenommen."
            : "Die Leistung wird mit den oben genannten Vorbehalten / Mängeln abgenommen."}
        </SectionBody>
      </Hotspot>
    </>
  );
}

function SchluesselSections({
  draft,
  edit,
  renderEditor,
}: {
  draft: SchluesselProtokoll;
  edit: boolean;
  renderEditor?: Props["renderEditor"];
}) {
  const opt: ProtokollOptionen = draft.optionen ?? {};
  const sekt = (k: "schluessel" | "bestaetigung", fb: string) =>
    (opt.sektionsTitel?.[k] && opt.sektionsTitel[k]!.trim()) || fb;
  const zeilen = draft.schluessel ?? [];
  const lineColor = opt.druckfreundlich ? "border-black/60" : "border-black";
  return (
    <>
      <SectionTitle>{sekt("schluessel", "Übergebene Schlüssel")}</SectionTitle>
      <Hotspot
        fieldId="schluessel.tabelle"
        enabled={edit}
        renderEditor={renderEditor}
        className="p-0.5"
      >
        <table className={cn("w-full border-collapse text-[10px]", lineColor)}>
          <thead>
            <tr>
              {[
                ["Bezeichnung", "text-left", "w-auto"],
                ["Anzahl", "text-center", "w-[14%]"],
                ["Schlüssel-Nr.", "text-left", "w-[22%]"],
                ["Bemerkung", "text-left", "w-[34%]"],
              ].map(([label, align, width]) => (
                <th
                  key={label}
                  className={cn(
                    "border px-2 py-1.5 font-bold",
                    align,
                    width,
                    lineColor,
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(zeilen.length > 0
              ? zeilen
              : [{ bezeichnung: "—", anzahl: 0, schluesselNr: "", bemerkung: "" }]
            ).map((z, i) => (
              <tr key={i}>
                <td className={cn("border px-2 py-1.5", lineColor)}>{z.bezeichnung || "—"}</td>
                <td className={cn("border px-2 py-1.5 text-center", lineColor)}>
                  {z.anzahl ?? 0}
                </td>
                <td className={cn("border px-2 py-1.5", lineColor)}>{z.schluesselNr || "—"}</td>
                <td className={cn("border px-2 py-1.5", lineColor)}>{z.bemerkung || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Hotspot>

      <Hotspot fieldId="pfand" enabled={edit} renderEditor={renderEditor} className="mt-2 p-1">
        <p
          className={cn(
            "text-[10px]",
            draft.pfandEur && draft.pfandEur > 0 ? "text-black" : "text-[#555]",
          )}
        >
          {draft.pfandEur && draft.pfandEur > 0
            ? `Hinterlegtes Pfand: ${draft.pfandEur.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })} EUR`
            : "Kein Pfand hinterlegt."}
        </p>
      </Hotspot>

      <Hotspot
        fieldId="bestaetigung"
        enabled={edit}
        renderEditor={renderEditor}
        className="mt-2 p-1"
      >
        <SectionTitle>{sekt("bestaetigung", "Bestätigung")}</SectionTitle>
        <ThinLine />
        <SectionBody>
          {draft.bestaetigt
            ? draft.richtung === "ausgabe"
              ? "Der Auftraggeber bestätigt den Erhalt der oben genannten Schlüssel."
              : "Der Auftragnehmer bestätigt die Rückgabe der oben genannten Schlüssel."
            : "Empfang/Rückgabe noch nicht bestätigt."}
        </SectionBody>
      </Hotspot>
    </>
  );
}