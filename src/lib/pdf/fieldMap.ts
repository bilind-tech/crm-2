// Grobe prozentuale Hotspot-Boxen für Click-to-Edit auf der PDF-Vorschau.
// Bezogen auf Seite 1 des Standard-Beleg-Layouts (Header, Adresse, Meta,
// Titel, Anrede, Intro, Tabelle, Summen, Outro).
//
// Bewusst grob: keine pdf.js-Koordinatenberechnung — gut genug, um den
// passenden Tab/das passende Feld im rechten Panel zu fokussieren.

export type FeldId =
  | "firma.logo"
  | "firma.absender"
  | "kunde.adresse"
  | "meta"
  | "titel"
  | "anrede"
  | "intro"
  | "tabelle"
  | "summe"
  | "outro";

export interface Hotspot {
  id: FeldId | string;
  page: number;
  /** Prozentuale Box (0..1) relativ zur Seitengröße. */
  box: { x: number; y: number; w: number; h: number };
  label: string;
  /** Tab im EditorPanel, der beim Klick aktiviert wird. */
  tab: "stammdaten" | "positionen" | "texte" | "logo";
  /** data-feld-id im EditorPanel, das fokussiert/gescrollt wird. */
  fieldId: string;
}

export const HOTSPOTS_SEITE_1: Hotspot[] = [
  { id: "firma.logo",     page: 1, box: { x: 0.04, y: 0.02, w: 0.30, h: 0.07 }, label: "Logo / Firma",        tab: "logo",       fieldId: "logo" },
  { id: "firma.absender", page: 1, box: { x: 0.50, y: 0.03, w: 0.46, h: 0.05 }, label: "Absenderzeile",       tab: "logo",       fieldId: "firma.absender" },
  { id: "kunde.adresse",  page: 1, box: { x: 0.04, y: 0.13, w: 0.45, h: 0.10 }, label: "Empfänger-Adresse",   tab: "stammdaten", fieldId: "kunde" },
  { id: "meta",           page: 1, box: { x: 0.55, y: 0.13, w: 0.41, h: 0.10 }, label: "Meta / Daten",         tab: "stammdaten", fieldId: "meta" },
  { id: "titel",          page: 1, box: { x: 0.04, y: 0.25, w: 0.92, h: 0.04 }, label: "Titel",                tab: "stammdaten", fieldId: "titel" },
  { id: "anrede",         page: 1, box: { x: 0.04, y: 0.31, w: 0.92, h: 0.03 }, label: "Anrede",               tab: "stammdaten", fieldId: "ansprechpartner" },
  { id: "intro",          page: 1, box: { x: 0.04, y: 0.35, w: 0.92, h: 0.07 }, label: "Einleitung",           tab: "texte",      fieldId: "intro" },
  { id: "tabelle",        page: 1, box: { x: 0.04, y: 0.43, w: 0.92, h: 0.30 }, label: "Positionen / Tabelle", tab: "positionen", fieldId: "positionen" },
  { id: "summe",          page: 1, box: { x: 0.55, y: 0.74, w: 0.41, h: 0.09 }, label: "Summen / Steuersatz",  tab: "stammdaten", fieldId: "steuersatz" },
  { id: "outro",          page: 1, box: { x: 0.04, y: 0.84, w: 0.92, h: 0.07 }, label: "Schlusstext",          tab: "texte",      fieldId: "outro" },
];
