import type {
  BezahltMarkierung,
  ManuellerPosten,
  SteuerEinstellungen,
  UstRhythmus,
} from "./types.js";

export interface EinstellungenRow {
  id: number;
  kst_satz: number;
  soli_satz: number;
  gewst_messzahl: number;
  gewst_hebesatz: number;
  ust_rhythmus: string;
  ruecklage_satz: number;
  ust_puffer_satz: number;
  updated_at: string;
}

export function rowToEinstellungen(r: EinstellungenRow): SteuerEinstellungen {
  return {
    kstSatz: r.kst_satz,
    soliSatz: r.soli_satz,
    gewstMesszahl: r.gewst_messzahl,
    gewstHebesatz: r.gewst_hebesatz,
    ustRhythmus: r.ust_rhythmus as UstRhythmus,
    ruecklageSatz: r.ruecklage_satz,
    ustPufferSatz: r.ust_puffer_satz,
    updatedAt: toIso(r.updated_at),
  };
}

export interface ManuellerRow {
  id: string;
  art: string;
  titel: string;
  zeitraum_jahr: number;
  zeitraum_monat: number | null;
  zeitraum_quartal: number | null;
  faellig_am: string;
  geschaetzter_betrag: number;
  notiz: string | null;
  erstellt_am: string;
}

export function rowToManueller(r: ManuellerRow): ManuellerPosten {
  return {
    id: r.id,
    art: r.art as ManuellerPosten["art"],
    titel: r.titel,
    zeitraum: {
      jahr: r.zeitraum_jahr,
      monat: r.zeitraum_monat,
      quartal: r.zeitraum_quartal,
    },
    faelligAm: r.faellig_am,
    geschaetzterBetrag: r.geschaetzter_betrag,
    notiz: r.notiz,
    erstelltAm: toIso(r.erstellt_am),
  };
}

export interface BezahltRow {
  posten_id: string;
  bezahlt_am: string;
  tatsaechlicher_betrag: number | null;
  notiz: string | null;
  erstellt_am: string;
}

export function rowToBezahlt(r: BezahltRow): BezahltMarkierung {
  return {
    postenId: r.posten_id,
    bezahltAm: r.bezahlt_am,
    tatsaechlicherBetrag: r.tatsaechlicher_betrag,
    notiz: r.notiz,
    erstelltAm: toIso(r.erstellt_am),
  };
}

/** SQLite liefert datetime('now') als "YYYY-MM-DD HH:MM:SS". */
function toIso(s: string): string {
  if (!s) return s;
  if (s.includes("T")) return s;
  return s.replace(" ", "T") + "Z";
}
