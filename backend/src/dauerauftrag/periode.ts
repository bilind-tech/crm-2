// Reine Helper rund um Perioden-Schlüssel (analog src/lib/dauerauftrag/termine.ts).
import type { DauerauftragApi, DauerauftragFrequenz } from "./repo.js";

const MONATE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

export function periodeFuer(frequenz: DauerauftragFrequenz, datum: Date): string {
  const j = datum.getFullYear();
  const m = datum.getMonth();
  switch (frequenz) {
    case "monatlich":     return `${j}-${String(m + 1).padStart(2, "0")}`;
    case "quartalsweise": return `${j}-Q${Math.floor(m / 3) + 1}`;
    case "halbjaehrlich": return `${j}-H${m < 6 ? 1 : 2}`;
    case "jaehrlich":     return String(j);
  }
}

export function periodeBezeichnung(frequenz: DauerauftragFrequenz, datum: Date): string {
  const j = datum.getFullYear();
  const m = datum.getMonth();
  switch (frequenz) {
    case "monatlich":     return `${MONATE[m]} ${j}`;
    case "quartalsweise": return `Q${Math.floor(m / 3) + 1} ${j}`;
    case "halbjaehrlich": return `${m < 6 ? "1. Halbjahr" : "2. Halbjahr"} ${j}`;
    case "jaehrlich":     return `Jahr ${j}`;
  }
}

export function periodeBereich(frequenz: DauerauftragFrequenz, datum: Date): { von: Date; bis: Date } {
  const j = datum.getFullYear();
  const m = datum.getMonth();
  switch (frequenz) {
    case "monatlich":     return { von: new Date(j, m, 1), bis: new Date(j, m + 1, 0) };
    case "quartalsweise": {
      const q = Math.floor(m / 3) * 3;
      return { von: new Date(j, q, 1), bis: new Date(j, q + 3, 0) };
    }
    case "halbjaehrlich": {
      const h = m < 6 ? 0 : 6;
      return { von: new Date(j, h, 1), bis: new Date(j, h + 6, 0) };
    }
    case "jaehrlich":     return { von: new Date(j, 0, 1), bis: new Date(j, 11, 31) };
  }
}

/** Stichtag innerhalb einer Periode anhand DA-Regel. */
export function stichtagFuerPeriode(da: DauerauftragApi, periode: string): Date {
  // Periode -> Jahr + Anker-Monat herleiten
  let jahr = new Date().getFullYear();
  let monat = 0;
  if (da.frequenz === "monatlich") {
    const m = /^(\d{4})-(\d{2})$/.exec(periode);
    if (m) { jahr = Number(m[1]); monat = Number(m[2]) - 1; }
  } else if (da.frequenz === "quartalsweise") {
    const m = /^(\d{4})-Q(\d)$/.exec(periode);
    if (m) { jahr = Number(m[1]); monat = (Number(m[2]) - 1) * 3; }
  } else if (da.frequenz === "halbjaehrlich") {
    const m = /^(\d{4})-H(\d)$/.exec(periode);
    if (m) { jahr = Number(m[1]); monat = Number(m[2]) === 1 ? 0 : 6; }
  } else if (da.frequenz === "jaehrlich") {
    const m = /^(\d{4})$/.exec(periode);
    if (m) { jahr = Number(m[1]); monat = 0; }
  }
  const t = da.stichtag.typ;
  if (t === "monatsletzter") return new Date(jahr, monat + 1, 0);
  const tag = da.stichtag.wert ?? 1;
  const letzter = new Date(jahr, monat + 1, 0).getDate();
  return new Date(jahr, monat, Math.min(tag, letzter));
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function aktuellePeriode(frequenz: DauerauftragFrequenz, ref: Date = new Date()): string {
  return periodeFuer(frequenz, ref);
}
