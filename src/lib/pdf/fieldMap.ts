// Mapping von Hotspot-Feld-IDs auf den passenden Tab und ein Anzeigelabel.
// Geometrie wird zur Laufzeit aus pdfmake gelesen (siehe hotspotTracker.ts) —
// hier nur noch UI-Metadaten + Fallback-Geometrie für den Notfall.

export type EditorTabId = "stammdaten" | "positionen" | "texte" | "logo";

export interface HotspotMeta {
  label: string;
  tab: EditorTabId;
  /** Feld-ID im EditorPanel (data-feld-id). */
  fieldId: string;
}

/** Statische Metadaten für bekannte Feld-IDs. Unbekannte (z.B. dynamische
 *  pos:<id>) werden zur Laufzeit ergänzt. */
export const FIELD_META: Record<string, HotspotMeta> = {
  logo: { label: "Logo / Firma", tab: "logo", fieldId: "logo" },
  "firma.absender": { label: "Absenderzeile", tab: "logo", fieldId: "firma.absender" },
  kunde: { label: "Empfänger-Adresse", tab: "stammdaten", fieldId: "kunde" },
  meta: { label: "Meta / Daten", tab: "stammdaten", fieldId: "meta" },
  titel: { label: "Titel", tab: "stammdaten", fieldId: "titel" },
  anrede: { label: "Anrede", tab: "stammdaten", fieldId: "ansprechpartner" },
  intro: { label: "Einleitung", tab: "texte", fieldId: "intro" },
  tabelle: { label: "Positionen", tab: "positionen", fieldId: "positionen" },
  summe: { label: "Summen / Steuer", tab: "stammdaten", fieldId: "steuersatz" },
  outro: { label: "Schlusstext", tab: "texte", fieldId: "outro" },
};

export function metaForId(id: string): HotspotMeta {
  if (FIELD_META[id]) return FIELD_META[id];
  if (id.startsWith("pos:")) {
    return { label: "Position bearbeiten", tab: "positionen", fieldId: "positionen" };
  }
  return { label: "Bearbeiten", tab: "stammdaten", fieldId: id };
}

// ───────────── Protokoll-Hotspots ────────────────────────────────────────────

export type ProtokollEditorTabId = "stammdaten" | "inhalt" | "unterschriften" | "optionen";

export interface ProtokollHotspotMeta {
  label: string;
  tab: ProtokollEditorTabId;
  fieldId: string;
}

export const PROTOKOLL_FIELD_META: Record<string, ProtokollHotspotMeta> = {
  kunde: { label: "Empfänger-Adresse", tab: "stammdaten", fieldId: "kunde" },
  meta: { label: "Datum / Uhrzeit / Nummer", tab: "stammdaten", fieldId: "datum" },
  titel: { label: "Titel & Untertitel", tab: "optionen", fieldId: "titel" },
  leistungsumfang: { label: "Leistungsumfang", tab: "inhalt", fieldId: "leistungsumfang" },
  bemerkungen: { label: "Mängel / Bemerkungen", tab: "inhalt", fieldId: "bemerkungen" },
  ergebnis: { label: "Ergebnis (Vorbehalt)", tab: "unterschriften", fieldId: "ergebnis" },
  klausel: { label: "Zusatzklausel", tab: "optionen", fieldId: "zusatzKlausel" },
  unterschriften: { label: "Unterschriften", tab: "unterschriften", fieldId: "vertreter" },
  "schluessel.tabelle": { label: "Schlüssel-Liste", tab: "inhalt", fieldId: "schluessel" },
  pfand: { label: "Pfand", tab: "inhalt", fieldId: "pfand" },
  bestaetigung: { label: "Bestätigung", tab: "unterschriften", fieldId: "bestaetigt" },
};

export function protokollMetaForId(id: string): ProtokollHotspotMeta {
  return PROTOKOLL_FIELD_META[id] ?? { label: "Bearbeiten", tab: "stammdaten", fieldId: id };
}

/** Fallback-Hotspots für Protokolle (Seite 1, prozentual), falls Tracker leer. */
export const FALLBACK_HOTSPOTS_PROTOKOLL_SEITE_1: FallbackHotspot[] = [
  { id: "kunde", page: 1, box: { x: 0.04, y: 0.13, w: 0.45, h: 0.1 } },
  { id: "meta", page: 1, box: { x: 0.55, y: 0.13, w: 0.41, h: 0.1 } },
  { id: "titel", page: 1, box: { x: 0.04, y: 0.25, w: 0.92, h: 0.05 } },
  { id: "leistungsumfang", page: 1, box: { x: 0.04, y: 0.33, w: 0.92, h: 0.12 } },
  { id: "bemerkungen", page: 1, box: { x: 0.04, y: 0.46, w: 0.92, h: 0.12 } },
  { id: "ergebnis", page: 1, box: { x: 0.04, y: 0.6, w: 0.92, h: 0.08 } },
  { id: "unterschriften", page: 1, box: { x: 0.04, y: 0.78, w: 0.92, h: 0.14 } },
];

/** Fallback-Hotspots (prozentual), falls der Tracker keinerlei Treffer liefert. */
export interface FallbackHotspot {
  id: string;
  page: number;
  /** Prozentuale Box (0..1) relativ zur Seitengröße. */
  box: { x: number; y: number; w: number; h: number };
}

export const FALLBACK_HOTSPOTS_SEITE_1: FallbackHotspot[] = [
  { id: "logo", page: 1, box: { x: 0.04, y: 0.02, w: 0.3, h: 0.07 } },
  { id: "firma.absender", page: 1, box: { x: 0.5, y: 0.03, w: 0.46, h: 0.05 } },
  { id: "kunde", page: 1, box: { x: 0.04, y: 0.13, w: 0.45, h: 0.1 } },
  { id: "meta", page: 1, box: { x: 0.55, y: 0.13, w: 0.41, h: 0.1 } },
  { id: "titel", page: 1, box: { x: 0.04, y: 0.25, w: 0.92, h: 0.04 } },
  { id: "anrede", page: 1, box: { x: 0.04, y: 0.31, w: 0.92, h: 0.03 } },
  { id: "intro", page: 1, box: { x: 0.04, y: 0.35, w: 0.92, h: 0.07 } },
  { id: "tabelle", page: 1, box: { x: 0.04, y: 0.43, w: 0.92, h: 0.3 } },
  { id: "summe", page: 1, box: { x: 0.55, y: 0.74, w: 0.41, h: 0.09 } },
  { id: "outro", page: 1, box: { x: 0.04, y: 0.84, w: 0.92, h: 0.07 } },
];
