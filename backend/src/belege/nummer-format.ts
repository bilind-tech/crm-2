// Single Source of Truth für Belegnummern-Format.
// Kein DB-Zugriff hier — pure Funktionen, einfach testbar.
//
// Format:
//   {PREFIX}{MMYY}/{NN}
// Wobei PREFIX entweder das Kunden-Kürzel ist (z.B. "GFU") oder ein
// Fallback-Präfix mit Kunden-Hash bei kürzelfreien Kunden:
//   "AN-K001"   (Angebot, Kunde K-2026-001)
//   "RE-K001"   (Rechnung, Kunde K-2026-001)

export type BelegArt = "angebot" | "rechnung";

export interface BelegnummerParts {
  prefix: string;
  /** MMYY */
  periode: string;
  nn: number;
}

/** Kürzel: 2–8 Zeichen A–Z/0–9, optional `-K123` Kunden-Suffix. Periode 4 Ziffern, NN 1–4 Ziffern. */
const RE = /^([A-Z0-9]{2,8}(?:-K\d{3,5})?)(\d{4})\/(\d{1,4})$/;

export function parseBelegnummer(s: string): BelegnummerParts | null {
  const m = RE.exec(s.trim().toUpperCase());
  if (!m) return null;
  const periode = m[2];
  const mm = Number(periode.slice(0, 2));
  if (mm < 1 || mm > 12) return null;
  return { prefix: m[1], periode, nn: Number(m[3]) };
}

export function formatBelegnummer(p: BelegnummerParts): string {
  return `${p.prefix}${p.periode}/${String(p.nn).padStart(2, "0")}`;
}

export function fallbackPrefix(art: BelegArt, kundennummer: string): string {
  // Aus "K-2026-001" wird "K001" — kompakt, eindeutig pro Kunde.
  const m = /(\d{1,5})$/.exec(kundennummer);
  const tail = m ? `K${m[1].padStart(3, "0")}` : "K000";
  return `${art === "angebot" ? "AN" : "RE"}-${tail}`;
}

/** "MMYY" für ein Datum. */
export function periodeMMYY(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);
  return `${m}${y}`;
}
