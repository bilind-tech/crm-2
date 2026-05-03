// Werkzeuge-Registry — zentrale Liste aller PDF-/Helfer-Werkzeuge.
// Neue Werkzeuge: Eintrag hier hinzufügen + zugehörige Route unter
// `src/routes/werkzeuge.<slug>.tsx` anlegen. Sonst nichts.

import type { ComponentType } from "react";
import { FileSignature, KeyRound } from "lucide-react";

export type WerkzeugGruppe = "PDF-Vorlagen" | "Sonstiges";

export interface WerkzeugDefinition {
  id: string;
  gruppe: WerkzeugGruppe;
  titel: string;
  beschreibung: string;
  icon: ComponentType<{ className?: string }>;
  /** TanStack Router Pfad. */
  route: string;
}

export const WERKZEUGE: WerkzeugDefinition[] = [
  {
    id: "uebergabeprotokoll",
    gruppe: "PDF-Vorlagen",
    titel: "Übergabe-/Abnahmeprotokoll",
    beschreibung:
      "Protokoll über die Übergabe oder Abnahme einer Reinigungsleistung als PDF erzeugen.",
    icon: FileSignature,
    route: "/werkzeuge/uebergabeprotokoll",
  },
  {
    id: "schluesseluebergabe",
    gruppe: "PDF-Vorlagen",
    titel: "Schlüsselübergabe",
    beschreibung:
      "Quittung über ausgegebene oder zurückgenommene Schlüssel inklusive Liste und Pfand.",
    icon: KeyRound,
    route: "/werkzeuge/schluesseluebergabe",
  },
];

export const WERKZEUG_GRUPPEN: WerkzeugGruppe[] = ["PDF-Vorlagen", "Sonstiges"];
