Ich habe die Ursache eingegrenzt: Die beiden Einstellungs-Tabs erwarten andere Datenfelder als das Backend tatsächlich liefert. Dadurch greifen die Komponenten auf nicht vorhandene Felder zu und die globale Fehlerseite erscheint.

Plan:

1. Nummernkreise-Tab korrigieren
- Frontend auf die echten Backend-Felder umstellen: `rechnungFormat`, `angebotFormat`, `startNummer`.
- Vorschau an das aktuelle Format `{KUERZEL}{MM}{YY}/{NN}` anpassen.
- Validierung so ändern, dass sie zu den realen Platzhaltern passt.

2. Daueraufträge-Tab korrigieren
- Frontend auf die echten Backend-Felder umstellen: `laufzeitTagBeforeFaellig`, `autoVersand`.
- Die fehlerauslösenden Zugriffe auf `defaultModus` und `defaultStichtag` entfernen.
- Dabei die bestehende Sicherheitsregel beachten: keine automatische E-Mail-Versendung. Falls `autoVersand` im UI bleibt, wird es klar als Rechnungserzeugung/Workflow-Option behandelt und nicht als Mail-Autoversand.

3. Typen angleichen
- `src/lib/api/types.ts` an die echten Backend-Schemas anpassen, damit solche Feld-Mismatches künftig beim Entwickeln auffallen.

4. Fehlerrobustheit verbessern
- Für beide Tabs Lade- und Fehlerzustände lokal anzeigen, statt die ganze App auf „Something went wrong“ fallen zu lassen.

5. Danach prüfen
- Gezielte Prüfung, dass `/einstellungen` wieder öffnet und die Tabs „Nummernkreise“ sowie „Daueraufträge“ nicht mehr abstürzen.