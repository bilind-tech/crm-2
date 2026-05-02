// Berechnungs-Engine für das Steuer-Modul.
// Reines Frontend — bezieht Daten aus React-Query (Rechnungen, Dokumente).

import type { Rechnung, Dokument } from "@/lib/api/types";
import { summenRechnung } from "@/lib/mock/backend";
import type {
  SteuerEinstellungen,
  SteuerPosten,
  UstRhythmus,
} from "./types";

// ---------- Helpers ----------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Bezahltes Datum einer Rechnung (letzte Zahlung) oder null. */
function bezahltAm(r: Rechnung): string | null {
  if (!r.zahlungen?.length) return null;
  const sorted = [...r.zahlungen].sort((a, b) => a.datum.localeCompare(b.datum));
  return sorted[sorted.length - 1].datum;
}

/** Ist die Rechnung als „bezahlt" zu werten (Vollzahlung)? */
function istVollBezahlt(r: Rechnung): boolean {
  if (r.status === "storniert" || r.status === "entwurf") return false;
  const { brutto } = summenRechnung(r.positionen, r.rabattGesamt);
  const summe = (r.zahlungen ?? []).reduce((s, z) => s + z.betrag, 0);
  return summe >= brutto - 0.005;
}

/** Periode (Monat oder Quartal) für ein Datum. */
function periode(date: string, rhythmus: UstRhythmus): { jahr: number; monat?: number; quartal?: 1 | 2 | 3 | 4 } {
  const d = new Date(date);
  const jahr = d.getFullYear();
  const monat = d.getMonth() + 1;
  if (rhythmus === "monatlich") return { jahr, monat };
  if (rhythmus === "quartalsweise") {
    const quartal = Math.ceil(monat / 3) as 1 | 2 | 3 | 4;
    return { jahr, quartal };
  }
  return { jahr };
}

/** Letzter Tag der Periode + Fälligkeit (10. Folgemonat). */
function ustFaelligAm(p: { jahr: number; monat?: number; quartal?: 1 | 2 | 3 | 4 }): string {
  let endMonat: number;
  if (p.monat) endMonat = p.monat;
  else if (p.quartal) endMonat = p.quartal * 3;
  else endMonat = 12;
  // 10. des Folgemonats
  const f = new Date(p.jahr, endMonat, 10); // Date(year, monthIndex0..) → endMonat (0-basiert) = nächster Monat
  return isoDate(f);
}

function periodeKey(p: { jahr: number; monat?: number; quartal?: 1 | 2 | 3 | 4 }): string {
  if (p.monat) return `${p.jahr}-M${String(p.monat).padStart(2, "0")}`;
  if (p.quartal) return `${p.jahr}-Q${p.quartal}`;
  return `${p.jahr}`;
}

function periodeLabel(p: { jahr: number; monat?: number; quartal?: 1 | 2 | 3 | 4 }): string {
  const monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  if (p.monat) return `${monate[p.monat - 1]} ${p.jahr}`;
  if (p.quartal) return `Q${p.quartal} ${p.jahr}`;
  return String(p.jahr);
}

// ---------- USt: aus bezahlten Rechnungen + Dokumenten ableiten ----------

interface UstAggregat {
  zeitraum: { jahr: number; monat?: number; quartal?: 1 | 2 | 3 | 4 };
  ust: number;
  vorsteuer: number;
  rechnungIds: string[];
  dokumentIds: string[];
}

export function aggregiereUst(
  rechnungen: Rechnung[],
  dokumente: Dokument[],
  rhythmus: UstRhythmus,
): UstAggregat[] {
  const map = new Map<string, UstAggregat>();

  for (const r of rechnungen) {
    if (!istVollBezahlt(r)) continue;
    const datum = bezahltAm(r);
    if (!datum) continue;
    const p = periode(datum, rhythmus);
    const key = periodeKey(p);
    const sums = summenRechnung(r.positionen, r.rabattGesamt);
    const agg = map.get(key) ?? { zeitraum: p, ust: 0, vorsteuer: 0, rechnungIds: [], dokumentIds: [] };
    agg.ust += sums.steuer;
    agg.rechnungIds.push(r.id);
    map.set(key, agg);
  }

  for (const d of dokumente) {
    if (!d.steuerrelevant || !d.betrag || !d.dokumentdatum) continue;
    const p = periode(d.dokumentdatum, rhythmus);
    const key = periodeKey(p);
    // Annahme: 19% USt im Bruttobetrag eingebettet (Vorsteuer = brutto/1.19 * 0.19)
    const vorsteuer = (d.betrag / 1.19) * 0.19;
    const agg = map.get(key) ?? { zeitraum: p, ust: 0, vorsteuer: 0, rechnungIds: [], dokumentIds: [] };
    agg.vorsteuer += vorsteuer;
    agg.dokumentIds.push(d.id);
    map.set(key, agg);
  }

  return Array.from(map.values()).sort((a, b) => periodeKey(a.zeitraum).localeCompare(periodeKey(b.zeitraum)));
}

// ---------- Gewinn-Aggregation YTD ----------

export interface GewinnAggregat {
  jahr: number;
  nettoEinnahmen: number;
  nettoAusgaben: number;
  gewinn: number;
  rechnungIds: string[];
  dokumentIds: string[];
}

export function gewinnYtd(
  rechnungen: Rechnung[],
  dokumente: Dokument[],
  jahr: number,
): GewinnAggregat {
  let nettoEinnahmen = 0;
  let nettoAusgaben = 0;
  const rechnungIds: string[] = [];
  const dokumentIds: string[] = [];

  for (const r of rechnungen) {
    if (!istVollBezahlt(r)) continue;
    const datum = bezahltAm(r);
    if (!datum) continue;
    if (new Date(datum).getFullYear() !== jahr) continue;
    const sums = summenRechnung(r.positionen, r.rabattGesamt);
    nettoEinnahmen += sums.netto;
    rechnungIds.push(r.id);
  }

  for (const d of dokumente) {
    if (!d.steuerrelevant || !d.betrag || !d.dokumentdatum) continue;
    if (new Date(d.dokumentdatum).getFullYear() !== jahr) continue;
    // Netto = brutto / 1.19
    nettoAusgaben += d.betrag / 1.19;
    dokumentIds.push(d.id);
  }

  return {
    jahr,
    nettoEinnahmen,
    nettoAusgaben,
    gewinn: nettoEinnahmen - nettoAusgaben,
    rechnungIds,
    dokumentIds,
  };
}

// ---------- Generierung: Steuerposten aus Aggregaten ----------

export function generiereAutomatischePosten(
  rechnungen: Rechnung[],
  dokumente: Dokument[],
  einstellungen: SteuerEinstellungen,
  jahr: number,
): SteuerPosten[] {
  const posten: SteuerPosten[] = [];
  const now = new Date().toISOString();

  // --- USt-Voranmeldungen ---
  const ust = aggregiereUst(rechnungen, dokumente, einstellungen.ustRhythmus);
  for (const u of ust) {
    if (u.zeitraum.jahr !== jahr) continue;
    const zahllast = u.ust - u.vorsteuer;
    const faellig = ustFaelligAm(u.zeitraum);
    const ueberfaellig = new Date(faellig) < new Date() && zahllast > 0;
    posten.push({
      id: `auto-ust-${periodeKey(u.zeitraum)}`,
      art: "ust",
      titel: `USt-Voranmeldung ${periodeLabel(u.zeitraum)}`,
      zeitraum: u.zeitraum,
      faelligAm: faellig,
      geschaetzterBetrag: Math.max(0, zahllast),
      status: zahllast <= 0 ? "bezahlt" : ueberfaellig ? "ueberfaellig" : "offen",
      automatisch: true,
      berechnungsgrundlage: {
        rechnungIds: u.rechnungIds,
        dokumentIds: u.dokumentIds,
        ust: u.ust,
        vorsteuer: u.vorsteuer,
      },
      erstelltAm: now,
    });
  }

  // --- Jahressteuern KSt + Soli + GewSt (auf YTD-Gewinn hochgerechnet) ---
  const g = gewinnYtd(rechnungen, dokumente, jahr);
  if (g.gewinn > 0) {
    const kst = g.gewinn * (einstellungen.kstSatz / 100);
    const soli = kst * (einstellungen.soliSatz / 100);
    const gewstSatz = (einstellungen.gewstMesszahl / 100) * (einstellungen.gewstHebesatz / 100);
    const gewst = g.gewinn * gewstSatz;

    // Nächste Vorauszahlungs-Termine
    const heute = new Date();
    const kstTermine = ["03-10", "06-10", "09-10", "12-10"];
    const gewstTermine = ["02-15", "05-15", "08-15", "11-15"];
    const naechsterTermin = (mmDdListe: string[]): string => {
      for (const md of mmDdListe) {
        const d = new Date(`${jahr}-${md}`);
        if (d >= heute) return isoDate(d);
      }
      return isoDate(new Date(jahr + 1, 2, 10));
    };

    posten.push({
      id: `auto-kst-${jahr}`,
      art: "kst",
      titel: `Körperschaftsteuer-Vorauszahlung ${jahr}`,
      zeitraum: { jahr },
      faelligAm: naechsterTermin(kstTermine),
      geschaetzterBetrag: kst / 4, // pro Quartal
      status: "offen",
      automatisch: true,
      berechnungsgrundlage: {
        rechnungIds: g.rechnungIds,
        dokumentIds: g.dokumentIds,
        nettoEinnahmen: g.nettoEinnahmen,
        nettoAusgaben: g.nettoAusgaben,
      },
      notiz: `Jahres-KSt geschätzt ${(kst).toFixed(2)} € (Gewinn YTD × ${einstellungen.kstSatz}%) — nächste Vorauszahlung 1/4`,
      erstelltAm: now,
    });

    posten.push({
      id: `auto-soli-${jahr}`,
      art: "soli",
      titel: `Solidaritätszuschlag ${jahr}`,
      zeitraum: { jahr },
      faelligAm: naechsterTermin(kstTermine),
      geschaetzterBetrag: soli / 4,
      status: "offen",
      automatisch: true,
      berechnungsgrundlage: {
        rechnungIds: g.rechnungIds,
        dokumentIds: g.dokumentIds,
      },
      notiz: `${einstellungen.soliSatz}% der KSt — nächste Vorauszahlung 1/4`,
      erstelltAm: now,
    });

    posten.push({
      id: `auto-gewst-${jahr}`,
      art: "gewst",
      titel: `Gewerbesteuer-Vorauszahlung ${jahr}`,
      zeitraum: { jahr },
      faelligAm: naechsterTermin(gewstTermine),
      geschaetzterBetrag: gewst / 4,
      status: "offen",
      automatisch: true,
      berechnungsgrundlage: {
        rechnungIds: g.rechnungIds,
        dokumentIds: g.dokumentIds,
        nettoEinnahmen: g.nettoEinnahmen,
        nettoAusgaben: g.nettoAusgaben,
      },
      notiz: `Hebesatz Sankt Augustin ${einstellungen.gewstHebesatz}% — Jahres-GewSt geschätzt ${(gewst).toFixed(2)} €`,
      erstelltAm: now,
    });
  }

  return posten;
}

// ---------- Aggregierte Kennzahlen ----------

export interface SteuerKennzahlen {
  /** Nächster fälliger offener Posten. */
  naechsteFaelligkeit: SteuerPosten | null;
  /** Summe aller offenen + überfälligen Posten. */
  offenSumme: number;
  /** Summe aller bezahlten Posten dieses Jahr. */
  bezahltJahrSumme: number;
  /** Empfohlene Rücklage = Gewinn YTD × ruecklageSatz. */
  empfohleneRuecklage: number;
  /** YTD-Gewinn (für Anzeige). */
  gewinnYtd: number;
  /** Projizierte Jahressteuer GmbH = Gewinn × 0,3420 (mit Defaults). */
  projizierteJahressteuer: number;
}

export function berechneKennzahlen(
  posten: SteuerPosten[],
  rechnungen: Rechnung[],
  dokumente: Dokument[],
  einstellungen: SteuerEinstellungen,
  jahr: number,
): SteuerKennzahlen {
  const offene = posten
    .filter((p) => p.status !== "bezahlt")
    .sort((a, b) => a.faelligAm.localeCompare(b.faelligAm));

  const offenSumme = offene.reduce((s, p) => s + p.geschaetzterBetrag, 0);
  const bezahltJahrSumme = posten
    .filter((p) => p.status === "bezahlt" && p.bezahltAm && new Date(p.bezahltAm).getFullYear() === jahr)
    .reduce((s, p) => s + (p.tatsaechlicherBetrag ?? p.geschaetzterBetrag), 0);

  const g = gewinnYtd(rechnungen, dokumente, jahr);
  const empfohleneRuecklage = Math.max(0, g.gewinn * (einstellungen.ruecklageSatz / 100));

  // Effektivsatz = KSt + Soli-auf-KSt + GewSt-effektiv
  const kstAnteil = einstellungen.kstSatz / 100;
  const soliAnteil = kstAnteil * (einstellungen.soliSatz / 100);
  const gewstAnteil = (einstellungen.gewstMesszahl / 100) * (einstellungen.gewstHebesatz / 100);
  const effektivSatz = kstAnteil + soliAnteil + gewstAnteil;
  const projizierteJahressteuer = Math.max(0, g.gewinn * effektivSatz);

  return {
    naechsteFaelligkeit: offene[0] ?? null,
    offenSumme,
    bezahltJahrSumme,
    empfohleneRuecklage,
    gewinnYtd: g.gewinn,
    projizierteJahressteuer,
  };
}

export const STEUER_ART_LABEL: Record<string, string> = {
  ust: "Umsatzsteuer",
  kst: "Körperschaftsteuer",
  soli: "Solidaritätszuschlag",
  gewst: "Gewerbesteuer",
  manuell: "Manuell",
};

export { periodeLabel, periodeKey };
