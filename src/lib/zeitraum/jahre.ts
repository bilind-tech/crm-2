// Dynamische Jahreslisten — kein hartcodiertes Startjahr.
// Liefert: alle in Daten vorkommenden Jahre + aktuelles Jahr + optional N Zukunftsjahre.

export interface VerfuegbareJahreOpts {
  /** Zusätzliche Zukunftsjahre nach aktuellem Jahr (Default 0). */
  zukunftJahre?: number;
  /** Aktuelles Jahr immer einschließen (Default true). */
  inklAktuelles?: boolean;
  /** Sortierung: "desc" (Default) oder "asc". */
  sort?: "asc" | "desc";
}

/**
 * Extrahiert Jahre aus heterogenen Werten:
 *  - Zahl (2026)
 *  - ISO-Datum-String ("2026-04-15", "2026-04")
 *  - Perioden-Schlüssel ("2026-04", "2026-Q2", "2026-H1", "2026")
 * Ungültige Werte werden ignoriert.
 */
export function verfuegbareJahre(
  daten: Iterable<string | number | undefined | null>,
  opts: VerfuegbareJahreOpts = {},
): number[] {
  const { zukunftJahre = 0, inklAktuelles = true, sort = "desc" } = opts;
  const set = new Set<number>();
  for (const wert of daten) {
    if (wert == null) continue;
    if (typeof wert === "number" && Number.isFinite(wert)) {
      set.add(wert);
      continue;
    }
    if (typeof wert === "string" && wert.length >= 4) {
      const y = Number.parseInt(wert.slice(0, 4), 10);
      if (Number.isFinite(y) && y > 1900 && y < 3000) set.add(y);
    }
  }
  const aktJahr = new Date().getFullYear();
  if (inklAktuelles) set.add(aktJahr);
  for (let i = 1; i <= zukunftJahre; i++) set.add(aktJahr + i);
  const arr = Array.from(set);
  arr.sort((a, b) => (sort === "asc" ? a - b : b - a));
  return arr;
}
