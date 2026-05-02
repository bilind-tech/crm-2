Ich habe den Fehler gefunden: Die Steuerseite erzeugt aktuell für KSt, Soli und GewSt vier Quartals-Vorauszahlungen auf Basis einer linearen Jahreshochrechnung. Anfang/Mitte des Jahres kann dadurch eine einzelne bezahlte Rechnung stark hochgerechnet werden und anschließend werden offene Quartale summiert. So kann die empfohlene Rücklage höher werden als der tatsächlich eingegangene Betrag. Das ist für deine gewünschte Liquiditätsanzeige falsch.

Plan zur Korrektur:

1. Ertragsteuer-Berechnung auf realistische Rücklage umstellen
   - KSt + Soli + GewSt werden nicht mehr als vier offene Vorauszahlungs-Posten aus einer aggressiven Jahreshochrechnung angezeigt.
   - Stattdessen wird die Rücklage aus dem tatsächlich bisher realisierten Netto-Gewinn berechnet:
     - Netto-Einnahmen aus vollständig bezahlten Rechnungen
     - minus steuerrelevante Netto-Ausgaben/Belege
     - nur wenn daraus Gewinn entsteht
   - Die Ertragsteuer-Rücklage bleibt dadurch immer maximal ein Anteil des Gewinns, nicht des Brutto-Umsatzes.
   - Bei z. B. 780 € brutto Einnahme kann die Ertragsteuer dadurch nicht mehr höher als der Zahlungseingang werden.

2. USt klar trennen von Ertragsteuer
   - Umsatzsteuer bleibt separat als Zahllast:
     - USt aus bezahlten Ausgangsrechnungen
     - minus Vorsteuer aus steuerrelevanten Belegen
   - Zusätzlich ergänze ich eine konservative Vorsteuer-/Kosten-Pauschale in den Steuer-Einstellungen, damit die USt nicht so wirkt, als wäre sie immer exakt, wenn noch nicht alle Belege erfasst sind.
   - Standard: 10–15 % Entlastung auf die USt-Zahllast, beschriftet als „Vorsteuer-Puffer / noch nicht erfasste Ausgaben“.
   - In der Anzeige steht dann nicht mehr „exakt“, sondern transparent: „berechnet aus erfassten Daten + Puffer“.

3. Falsche Rücklagen-KPI reparieren
   - „Empfohlene Rücklage“ wird künftig aus zwei Blöcken berechnet:
     - offene USt-Zahllast nach erfasster Vorsteuer/Puffer
     - Ertragsteuer-Rücklage auf bisherigen Gewinn
   - Bereits als bezahlt markierte Steuerposten werden abgezogen.
   - Negative Beträge oder Erstattungen erhöhen die Rücklage nicht.

4. UI-Texte verständlicher machen
   - Die Steuerseite bekommt klare Hinweise:
     - „USt: Schätzung, solange nicht alle Eingangsbelege erfasst sind“
     - „KSt/Soli/GewSt: Rücklage auf Gewinn, nicht auf Umsatz“
     - „Keine Steuerberatung“ bleibt bestehen.
   - Die bisher irreführenden Texte wie „USt exakt“ werden angepasst.

5. Detaildialog transparenter machen
   - Im Steuer-Detaildialog zeige ich die Berechnungsgrundlage sauber an:
     - Brutto/Netto-Einnahmen
     - erfasste Netto-Ausgaben
     - Gewinnbasis
     - verwendeter Steuersatz
     - abgezogene Vorsteuer bzw. Puffer

Technische Umsetzung:

- `src/lib/steuern/types.ts`
  - Neue Einstellung für USt-Puffer/Vorsteuer-Schätzung ergänzen, z. B. `ustPufferSatz`.

- `src/lib/steuern/berechnung.ts`
  - Aggressive Jahreshochrechnung für Ertragsteuern entfernen oder entschärfen.
  - KSt/Soli/GewSt auf tatsächlichem YTD-Gewinn berechnen.
  - USt-Zahllast um erfasste Vorsteuer und optionalen Puffer reduzieren.
  - Rücklage so begrenzen, dass sie nicht durch hochgerechnete Quartals-Duplizierung unrealistisch wird.

- `src/routes/steuern.tsx`
  - KPI und Rücklagen-Aufschlüsselung auf die neue Berechnung umstellen.
  - Texte und Labels korrigieren.

- `src/components/einstellungen/SteuerTab.tsx`
  - Feld für USt-Puffer hinzufügen, damit du z. B. 10 %, 15 % oder 0 % einstellen kannst.

- `src/components/steuern/SteuerDetailDialog.tsx`
  - Berechnungsdetails verständlicher anzeigen.

Ergebnis:

Die Steuerseite zeigt danach keine unmöglichen Werte mehr wie „795 € Rücklage“ bei nur 780 € Zahlungseingang. USt und Ertragsteuern werden getrennt, realistischer und nachvollziehbar angezeigt.