// FTS5-Suche über kunde / objekt / notiz.
// Wir bauen einen prefix-toleranten MATCH-String. Sicherer Umgang mit Sonderzeichen
// via Whitelist + Tokenisierung — keine direkte String-Konkatenation in MATCH.
import { getDatabase } from "../db/index.js";

export interface SuchTreffer {
  id: string;
  typ: "kunde" | "objekt" | "notiz";
  titel: string;
  untertitel?: string;
  link: { route: string; params?: Record<string, string> };
}

interface Row {
  entity_typ: "kunde" | "objekt" | "notiz";
  entity_id: string;
  titel: string;
  untertitel: string | null;
  link_route: string;
  link_param_id: string;
}

/** Wandelt freien User-Input in einen FTS5-tauglichen MATCH-Ausdruck. */
function buildMatch(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9äöüß ]+/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;
  // jeder Token als Prefix (term*) AND-verknüpft
  return tokens.map((t) => `${t}*`).join(" AND ");
}

export function suche(q: string, limit = 25): SuchTreffer[] {
  const match = buildMatch(q);
  if (!match) return [];
  try {
    const rows = getDatabase()
      .prepare(
        `SELECT entity_typ, entity_id, titel, untertitel, link_route, link_param_id
           FROM suche_idx
          WHERE suche_idx MATCH ?
          ORDER BY rank
          LIMIT ?`,
      )
      .all(match, limit) as Row[];
    return rows.map((r) => ({
      id: r.entity_id,
      typ: r.entity_typ,
      titel: r.titel,
      untertitel: r.untertitel ?? undefined,
      link: {
        route: r.link_route,
        params: r.link_param_id ? { id: r.link_param_id } : undefined,
      },
    }));
  } catch (e) {
    // Defensiv: ein malformer MATCH-String darf den Endpoint nicht kippen.
    console.error("FTS error:", e);
    return [];
  }
}
