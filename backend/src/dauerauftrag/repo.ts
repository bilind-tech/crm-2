// Repository: Daueraufträge, Läufe, Sonderpositionen.
import crypto from "node:crypto";
import { getDatabase } from "../db/index.js";

export type DauerauftragFrequenz = "monatlich" | "quartalsweise" | "halbjaehrlich" | "jaehrlich";
export type DauerauftragStatus = "aktiv" | "pausiert" | "beendet";
export type DauerauftragModus = "entwurf" | "vollautomatisch";
export type DauerauftragStichtagTyp = "monatstag" | "monatsletzter" | "quartalstag";
export type LaufStatus = "geplant" | "erzeugt" | "uebersprungen" | "fehler";

export interface DauerauftragPositionInput {
  id?: string;
  beschreibung?: string;
  menge?: number;
  einheit?: string;
  einzelpreisNetto?: number;
  steuersatz?: number;
  rabatt?: number;
  modus?: "einzel" | "pauschal" | "stunden";
  pauschalpreisNetto?: number;
  ausfuehrung?: string;
}

export interface DauerauftragApi {
  id: string;
  nummer: string;
  kundeId: string;
  objektId?: string;
  ansprechpartnerId?: string;
  bezeichnung: string;
  frequenz: DauerauftragFrequenz;
  stichtag: { typ: DauerauftragStichtagTyp; wert?: number };
  laufzeitVon: string;
  laufzeitBis?: string;
  positionen: DauerauftragPositionInput[];
  rabattGesamt: number;
  steuersatz: number;
  betreffVorlage: string;
  textVorlage: string;
  modus: DauerauftragModus;
  emailEmpfaenger: string[];
  status: DauerauftragStatus;
  pausiertBis?: string;
  letzteAusfuehrung?: string;
  notizen?: string;
  erstelltAm: string;
  geaendertAm: string;
}

export interface DauerauftragLaufApi {
  id: string;
  dauerauftragId: string;
  periode: string;
  geplantFuer: string;
  ausgefuehrtAm?: string;
  rechnungId?: string;
  status: LaufStatus;
  fehlerGrund?: string;
}

export interface DauerauftragSonderpositionApi {
  id: string;
  dauerauftragId: string;
  fuerPeriode: string;
  position: DauerauftragPositionInput;
  verbrauchtAm?: string;
}

interface DbDA {
  id: string;
  nummer: string;
  kunde_id: string;
  objekt_id: string | null;
  ansprechpartner_id: string | null;
  bezeichnung: string;
  frequenz: string;
  stichtag_typ: string;
  stichtag_wert: number | null;
  laufzeit_von: string;
  laufzeit_bis: string | null;
  positionen: string;
  rabatt_gesamt: number;
  steuersatz: number;
  betreff_vorlage: string;
  text_vorlage: string;
  modus: string;
  email_empfaenger: string;
  status: string;
  pausiert_bis: string | null;
  letzte_ausfuehrung: string | null;
  notizen: string | null;
  erstellt_am: string;
  geaendert_am: string;
}

interface DbLauf {
  id: string;
  dauerauftrag_id: string;
  periode: string;
  geplant_fuer: string;
  ausgefuehrt_am: string | null;
  rechnung_id: string | null;
  status: string;
  fehler_grund: string | null;
}

interface DbSopo {
  id: string;
  dauerauftrag_id: string;
  fuer_periode: string;
  position: string;
  verbraucht_am: string | null;
}

function iso(s: string): string {
  return s.includes("T") ? s : s.replace(" ", "T") + "Z";
}
function parseJson<T>(s: string | null, fb: T): T {
  if (!s) return fb;
  try { return JSON.parse(s) as T; } catch { return fb; }
}

function rowToApi(r: DbDA): DauerauftragApi {
  return {
    id: r.id,
    nummer: r.nummer,
    kundeId: r.kunde_id,
    objektId: r.objekt_id ?? undefined,
    ansprechpartnerId: r.ansprechpartner_id ?? undefined,
    bezeichnung: r.bezeichnung,
    frequenz: r.frequenz as DauerauftragFrequenz,
    stichtag: { typ: r.stichtag_typ as DauerauftragStichtagTyp, wert: r.stichtag_wert ?? undefined },
    laufzeitVon: r.laufzeit_von,
    laufzeitBis: r.laufzeit_bis ?? undefined,
    positionen: parseJson<DauerauftragPositionInput[]>(r.positionen, []),
    rabattGesamt: r.rabatt_gesamt,
    steuersatz: r.steuersatz,
    betreffVorlage: r.betreff_vorlage,
    textVorlage: r.text_vorlage,
    modus: r.modus as DauerauftragModus,
    emailEmpfaenger: parseJson<string[]>(r.email_empfaenger, []),
    status: r.status as DauerauftragStatus,
    pausiertBis: r.pausiert_bis ?? undefined,
    letzteAusfuehrung: r.letzte_ausfuehrung ?? undefined,
    notizen: r.notizen ?? undefined,
    erstelltAm: iso(r.erstellt_am),
    geaendertAm: iso(r.geaendert_am),
  };
}

function laufToApi(r: DbLauf): DauerauftragLaufApi {
  return {
    id: r.id,
    dauerauftragId: r.dauerauftrag_id,
    periode: r.periode,
    geplantFuer: r.geplant_fuer,
    ausgefuehrtAm: r.ausgefuehrt_am ? iso(r.ausgefuehrt_am) : undefined,
    rechnungId: r.rechnung_id ?? undefined,
    status: r.status as LaufStatus,
    fehlerGrund: r.fehler_grund ?? undefined,
  };
}

function sopoToApi(r: DbSopo): DauerauftragSonderpositionApi {
  return {
    id: r.id,
    dauerauftragId: r.dauerauftrag_id,
    fuerPeriode: r.fuer_periode,
    position: parseJson<DauerauftragPositionInput>(r.position, {}),
    verbrauchtAm: r.verbraucht_am ? iso(r.verbraucht_am) : undefined,
  };
}

const DA_COLS = `id, nummer, kunde_id, objekt_id, ansprechpartner_id, bezeichnung, frequenz,
  stichtag_typ, stichtag_wert, laufzeit_von, laufzeit_bis, positionen, rabatt_gesamt, steuersatz,
  betreff_vorlage, text_vorlage, modus, email_empfaenger, status, pausiert_bis, letzte_ausfuehrung,
  notizen, erstellt_am, geaendert_am`;
const LAUF_COLS = `id, dauerauftrag_id, periode, geplant_fuer, ausgefuehrt_am, rechnung_id, status, fehler_grund`;
const SOPO_COLS = `id, dauerauftrag_id, fuer_periode, position, verbraucht_am`;

function nextNummer(): string {
  const db = getDatabase();
  const jahr = new Date().getFullYear();
  const prefix = `DA-${jahr}-`;
  const row = db.prepare(
    `SELECT nummer FROM dauerauftrag WHERE nummer LIKE ? ORDER BY nummer DESC LIMIT 1`,
  ).get(`${prefix}%`) as { nummer: string } | undefined;
  let next = 1;
  if (row) {
    const m = /-(\d+)$/.exec(row.nummer);
    if (m) next = Number(m[1]) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function listDauerauftraege(): DauerauftragApi[] {
  const rows = getDatabase()
    .prepare(`SELECT ${DA_COLS} FROM dauerauftrag ORDER BY geaendert_am DESC`)
    .all() as DbDA[];
  return rows.map(rowToApi);
}

export function getDauerauftrag(id: string): DauerauftragApi | null {
  const r = getDatabase().prepare(`SELECT ${DA_COLS} FROM dauerauftrag WHERE id = ?`).get(id) as
    | DbDA
    | undefined;
  return r ? rowToApi(r) : null;
}

export interface DauerauftragWrite {
  kundeId: string;
  objektId?: string | null;
  ansprechpartnerId?: string | null;
  bezeichnung?: string;
  frequenz?: DauerauftragFrequenz;
  stichtag?: { typ: DauerauftragStichtagTyp; wert?: number };
  laufzeitVon?: string;
  laufzeitBis?: string | null;
  positionen?: DauerauftragPositionInput[];
  rabattGesamt?: number;
  steuersatz?: number;
  betreffVorlage?: string;
  textVorlage?: string;
  modus?: DauerauftragModus;
  emailEmpfaenger?: string[];
  status?: DauerauftragStatus;
  pausiertBis?: string | null;
  notizen?: string | null;
}

export function createDauerauftrag(data: DauerauftragWrite): DauerauftragApi {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const nummer = nextNummer();
  db.prepare(`INSERT INTO dauerauftrag (
    id, nummer, kunde_id, objekt_id, ansprechpartner_id, bezeichnung, frequenz,
    stichtag_typ, stichtag_wert, laufzeit_von, laufzeit_bis, positionen,
    rabatt_gesamt, steuersatz, betreff_vorlage, text_vorlage, modus,
    email_empfaenger, status, pausiert_bis, notizen
  ) VALUES (
    @id, @nummer, @kunde_id, @objekt_id, @ansprechpartner_id, @bezeichnung, @frequenz,
    @stichtag_typ, @stichtag_wert, @laufzeit_von, @laufzeit_bis, @positionen,
    @rabatt_gesamt, @steuersatz, @betreff_vorlage, @text_vorlage, @modus,
    @email_empfaenger, @status, @pausiert_bis, @notizen
  )`).run({
    id,
    nummer,
    kunde_id: data.kundeId,
    objekt_id: data.objektId ?? null,
    ansprechpartner_id: data.ansprechpartnerId ?? null,
    bezeichnung: data.bezeichnung ?? "Dauerauftrag",
    frequenz: data.frequenz ?? "monatlich",
    stichtag_typ: data.stichtag?.typ ?? "monatstag",
    stichtag_wert: data.stichtag?.wert ?? 1,
    laufzeit_von: data.laufzeitVon ?? new Date().toISOString().slice(0, 10),
    laufzeit_bis: data.laufzeitBis ?? null,
    positionen: JSON.stringify(data.positionen ?? []),
    rabatt_gesamt: data.rabattGesamt ?? 0,
    steuersatz: data.steuersatz ?? 19,
    betreff_vorlage: data.betreffVorlage ?? "Rechnung {{lauf.zeitraum}}",
    text_vorlage: data.textVorlage ?? "",
    modus: data.modus ?? "entwurf",
    email_empfaenger: JSON.stringify(data.emailEmpfaenger ?? []),
    status: data.status ?? "aktiv",
    pausiert_bis: data.pausiertBis ?? null,
    notizen: data.notizen ?? null,
  });
  return getDauerauftrag(id)!;
}

const UPDATABLE: Record<string, { col: string; transform?: (v: unknown) => unknown }> = {
  objektId: { col: "objekt_id" },
  ansprechpartnerId: { col: "ansprechpartner_id" },
  bezeichnung: { col: "bezeichnung" },
  frequenz: { col: "frequenz" },
  laufzeitVon: { col: "laufzeit_von" },
  laufzeitBis: { col: "laufzeit_bis" },
  rabattGesamt: { col: "rabatt_gesamt" },
  steuersatz: { col: "steuersatz" },
  betreffVorlage: { col: "betreff_vorlage" },
  textVorlage: { col: "text_vorlage" },
  modus: { col: "modus" },
  status: { col: "status" },
  pausiertBis: { col: "pausiert_bis" },
  notizen: { col: "notizen" },
  positionen: { col: "positionen", transform: (v) => JSON.stringify(v ?? []) },
  emailEmpfaenger: { col: "email_empfaenger", transform: (v) => JSON.stringify(v ?? []) },
};

export function updateDauerauftrag(id: string, patch: Record<string, unknown>): DauerauftragApi | null {
  const db = getDatabase();
  if (!getDauerauftrag(id)) return null;
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(patch)) {
    const def = UPDATABLE[k];
    if (!def) continue;
    sets.push(`${def.col} = @${def.col}`);
    params[def.col] = def.transform ? def.transform(v) : v ?? null;
  }
  if (patch.stichtag && typeof patch.stichtag === "object") {
    const st = patch.stichtag as { typ?: string; wert?: number };
    if (st.typ) {
      sets.push(`stichtag_typ = @stichtag_typ`);
      params.stichtag_typ = st.typ;
    }
    if (st.wert !== undefined) {
      sets.push(`stichtag_wert = @stichtag_wert`);
      params.stichtag_wert = st.wert;
    }
  }
  if (sets.length) {
    db.prepare(`UPDATE dauerauftrag SET ${sets.join(", ")} WHERE id = @id`).run(params);
  }
  return getDauerauftrag(id);
}

export function deleteDauerauftrag(id: string): boolean {
  const r = getDatabase().prepare(`DELETE FROM dauerauftrag WHERE id = ?`).run(id);
  return r.changes > 0;
}

// ----- Läufe -----

export function listLaeufe(status?: string): DauerauftragLaufApi[] {
  const sql = status
    ? `SELECT ${LAUF_COLS} FROM dauerauftrag_lauf WHERE status = ? ORDER BY geplant_fuer DESC`
    : `SELECT ${LAUF_COLS} FROM dauerauftrag_lauf ORDER BY geplant_fuer DESC`;
  const rows = (status
    ? getDatabase().prepare(sql).all(status)
    : getDatabase().prepare(sql).all()) as DbLauf[];
  return rows.map(laufToApi);
}

export function listLaeufeFuer(daId: string): DauerauftragLaufApi[] {
  const rows = getDatabase()
    .prepare(`SELECT ${LAUF_COLS} FROM dauerauftrag_lauf WHERE dauerauftrag_id = ? ORDER BY geplant_fuer DESC`)
    .all(daId) as DbLauf[];
  return rows.map(laufToApi);
}

export function findLauf(daId: string, periode: string): DauerauftragLaufApi | null {
  const r = getDatabase()
    .prepare(`SELECT ${LAUF_COLS} FROM dauerauftrag_lauf WHERE dauerauftrag_id = ? AND periode = ?`)
    .get(daId, periode) as DbLauf | undefined;
  return r ? laufToApi(r) : null;
}

export function createLauf(input: {
  dauerauftragId: string;
  periode: string;
  geplantFuer: string;
  rechnungId?: string;
  status?: LaufStatus;
}): DauerauftragLaufApi {
  const id = crypto.randomUUID();
  const status = input.status ?? (input.rechnungId ? "erzeugt" : "geplant");
  getDatabase().prepare(`INSERT INTO dauerauftrag_lauf (
    id, dauerauftrag_id, periode, geplant_fuer, ausgefuehrt_am, rechnung_id, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    input.dauerauftragId,
    input.periode,
    input.geplantFuer,
    input.rechnungId ? new Date().toISOString() : null,
    input.rechnungId ?? null,
    status,
  );
  if (input.rechnungId) {
    getDatabase().prepare(`UPDATE dauerauftrag SET letzte_ausfuehrung = ? WHERE id = ?`)
      .run(new Date().toISOString().slice(0, 10), input.dauerauftragId);
  }
  return findLauf(input.dauerauftragId, input.periode)!;
}

// ----- Sonderpositionen -----

export function listSonderpositionen(daId: string): DauerauftragSonderpositionApi[] {
  const rows = getDatabase()
    .prepare(`SELECT ${SOPO_COLS} FROM dauerauftrag_sonderposition WHERE dauerauftrag_id = ? ORDER BY erstellt_am ASC`)
    .all(daId) as DbSopo[];
  return rows.map(sopoToApi);
}

export function createSonderposition(input: {
  dauerauftragId: string;
  fuerPeriode: string;
  position: DauerauftragPositionInput;
}): DauerauftragSonderpositionApi {
  const id = crypto.randomUUID();
  getDatabase().prepare(`INSERT INTO dauerauftrag_sonderposition (
    id, dauerauftrag_id, fuer_periode, position
  ) VALUES (?, ?, ?, ?)`).run(
    id,
    input.dauerauftragId,
    input.fuerPeriode,
    JSON.stringify(input.position),
  );
  const r = getDatabase()
    .prepare(`SELECT ${SOPO_COLS} FROM dauerauftrag_sonderposition WHERE id = ?`)
    .get(id) as DbSopo;
  return sopoToApi(r);
}

export function markSonderpositionenVerbraucht(daId: string, periode: string): void {
  getDatabase()
    .prepare(`UPDATE dauerauftrag_sonderposition SET verbraucht_am = datetime('now')
              WHERE dauerauftrag_id = ? AND fuer_periode = ? AND verbraucht_am IS NULL`)
    .run(daId, periode);
}

export function deleteSonderposition(id: string): boolean {
  return getDatabase().prepare(`DELETE FROM dauerauftrag_sonderposition WHERE id = ?`).run(id).changes > 0;
}
