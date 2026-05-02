# Code-Review Steuer-Modul — gefundene Probleme

Ich habe alle frisch erstellten Dateien (`berechnung.ts`, `store.ts`, `types.ts`, `routes/steuern.tsx`, `SteuerTab.tsx`, `SteuerBezahltDialog.tsx`, `SteuerDetailDialog.tsx`, `ManuellerPostenDialog.tsx`) durchgelesen. Hier die Funde, sortiert nach Schweregrad.

## Bugs (müssen gefixt werden)

### 1. USt-Fälligkeit ist um 1 Monat verschoben (echter Rechen-Bug)
In `berechnung.ts → ustFaelligAm`:
```
const f = new Date(p.jahr, endMonat, 10);
```
`new Date(jahr, monthIndex, 10)` erwartet `monthIndex` 0-basiert. Bei `endMonat=1` (Januar) entsteht `10. Februar` — also *Folgemonat*. Das war so beabsichtigt für „10. des Folgemonats" laut Kommentar.
**Aber:** Bei Quartalen ist `endMonat = quartal*3`, also Q1 = 3. `new Date(jahr, 3, 10)` = **10. April** = Folgemonat von März → korrekt.
Bei Jahres-USt: `endMonat = 12` → `new Date(jahr, 12, 10)` = **10. Januar Folgejahr** → korrekt.
**→ Tatsächlich korrekt, aber Dezember-Edge-Case prüfen.** Bei monatlicher USt für Dezember: `endMonat=12` → `10. Januar Folgejahr` ✓. Doch der Code-Pfad stimmt nur, wenn der gleiche Zweig genutzt wird. Hier ist Reihenfolge `if monat / else if quartal / else 12`. Für Dez-Monat: `endMonat=12`, `Date(jahr,12,10)` = 10.01.Folgejahr ✓.
**→ KEIN Bug, nur unklar. Verbesserung: Kommentar präzisieren.**

### 2. USt-Bug bei jährlichem Rhythmus + KEIN Posten in Q4
In `aggregiereUst`: Wenn der User „jährlich" wählt, aber im laufenden Jahr noch keine bezahlte Rechnung existiert, wird kein USt-Posten erzeugt — dasselbe gilt bei „monatlich" für Monate ohne Umsatz. **Funktional OK** (kein Posten = nichts fällig), aber die Vorsteuer-Belege ohne zugehörigen USt-Posten werden ignoriert. Jeder Vorsteuer-Beleg sollte trotzdem als Erstattungs-Posten (negativ) sichtbar sein.
**Fix:** auch reine Vorsteuer-Perioden als Posten erzeugen, mit `geschaetzterBetrag = max(0, ust − vorsteuer)` und Notiz „Vorsteuer-Überhang X € → Erstattung".

### 3. KSt/Soli/GewSt-Vorauszahlung: Datum springt zu früh
In `generiereAutomatischePosten`: `naechsterTermin` gibt das nächste **zukünftige** Termin-Datum zurück. Sobald der Termin überschritten ist, springt er auf den nächsten — der überfällige Posten verschwindet aus der UI. Das ist falsch: wenn am 11.03. die KSt-Vorauszahlung nicht bezahlt wurde, sollte sie **als überfällig** angezeigt werden, nicht stillschweigend auf 10.06. verschoben werden.
**Fix:** Nicht „nächster Termin", sondern **alle vier Quartalstermine** des Jahres als separate Posten erzeugen (ID `auto-kst-${jahr}-Q1` etc.). Vergangene Termine: Status aus Bezahlt-Map ableiten, sonst „überfällig".

### 4. KSt/Soli/GewSt-Betrag wird auf alle 4 Quartale gleich verteilt
`geschaetzterBetrag: kst / 4`. Aber YTD-Gewinn ist „bis heute" — bei Generierung im März ist Hochrechnung × 1/4 zu niedrig (echter Jahres-Gewinn wird unterschätzt, weil März nur 25 % des Jahres ist). 
**Fix:** Jahres-Gewinn linear hochrechnen: `prognoseJahr = gewinnYtd * 365 / tageDesJahresVergangen`, dann KSt davon × 1/4. Oder simpler: Nur die **bereits bezahlten Quartale** anhand YTD ausweisen, kommende Quartale mit Vermerk „auf Basis YTD-Hochrechnung — noch unsicher".

### 5. `bezahltJahrSumme` rechnet manuelle Posten doppelt
In `berechneKennzahlen`: filtert nach `p.bezahltAm`. Manuelle Posten setzen `bezahltAm` direkt im Posten (über `update()`), automatische über `bezahltMap`. In der UI werden auto-Posten via `bezahltMap` zu `status:"bezahlt"` mit `bezahltAm` gemerged → korrekt. **Kein Bug**, aber `tatsaechlicherBetrag ?? geschaetzterBetrag` für Summen ist konsistent. ✓

### 6. ManuellerPostenDialog: kein Validation-Hinweis bei `betrag = 0`
`parseFloat("")` → 0, wird kommentarlos gespeichert. Akzeptabel, aber UX-Schwäche. **Fix:** Mindestens visueller Hinweis „Betrag schätzen" wenn 0.

### 7. SteuerBezahltDialog `parseEUInput` akzeptiert keine Tausenderpunkte
`"1.234,56"` → cleaned `"1.234.56"` → `parseFloat` = 1.234. **Fix:** erst alle `.` entfernen, dann `,` → `.`. Wie in anderen Dialogen (`ZahlungErfassenDialog` als Referenz prüfen).

## Verbesserungen (nice-to-have)

### 8. Cross-Tab-Sync wird nicht genutzt
`useStorageSync` ist exportiert, aber nirgends gerufen. Wenn der User in zwei Tabs gleichzeitig arbeitet, sieht er Stale-Daten. **Fix:** in `useSteuerEinstellungen`, `useManuellePosten`, `useBezahltMarkierungen` jeweils einen `storage`-Listener registrieren, der den State neu aus localStorage lädt.

### 9. Vorsteuer-Annahme „immer 19 %" ist falsch für Belege mit 7 %
In `aggregiereUst` und `gewinnYtd`: `d.betrag / 1.19 * 0.19`. Belege können auch 7 % USt enthalten (Bücher, ÖPNV, manche Dienstleistungen) oder steuerfrei sein. **Fix:** `Dokument`-Typ um optionales Feld `ustSatz` erweitern, beim Upload abfragen, default 19. Bis dahin: Disclaimer im Detail-Dialog „Vorsteuer pauschal 19 % angenommen".

### 10. Manuelle Posten ohne `bezahltAm` werden nie als „bezahlt" gezählt
In `useManuellePosten` gibt es kein UI, um einen manuellen Posten als bezahlt zu markieren. Der „Bezahlt"-Button ruft `setBezahltDialog`, der ruft `handleBezahlt`, der ruft nur für `auto-`-IDs `setBezahlt`. Manuelle Posten werden also **nie** bezahlbar markiert. **Fix:** in `handleBezahlt` auch für `man-`-IDs den `update`-Call aus `useManuellePosten` triggern.

### 11. „Aufschlüsselung pro Steuerart" zeigt Soli nicht
In `proArt` wird nach `p.art` gruppiert — Soli wird gerendert (Kachel ist da), aber `ART_TONE.soli = "default"` und Icon = `FileSpreadsheet`. Optisch unauffällig. Verbesserung: Soli neben KSt zusammenfassen oder visuell stärker als Sub-Posten markieren.

### 12. KpiCard `tone` für 0 €-Fall
„Offen gesamt" mit 0 € → `tone="default"` ist OK. „Empfohlene Rücklage" bei `gewinnYtd < 0` (Verlust) zeigt 0 €, aber ohne Hinweis dass YTD im Minus ist. **Fix:** sublabel anpassen wenn Gewinn negativ.

### 13. Routing-Fehler-Boundary fehlt
`createFileRoute("/steuern")` hat weder `errorComponent` noch `notFoundComponent`. Anderen Routen im Projekt prüfen — wenn dort Standard, hier nachziehen.

### 14. Memory-Regel: keine Gradients in Dialogen ✓
Geprüft — alle drei neuen Dialoge nutzen `bg-background`, keine Sparkles. ✓

## Vorgeschlagene Fix-Reihenfolge

1. **Sofort (Bugs 3 + 4 + 7 + 10):** echte Logikfehler, die zu falschen Beträgen / nicht-funktionierenden Buttons führen.
2. **Wichtig (Bug 2 + Verbesserung 9):** Vorsteuer-Logik vervollständigen + Disclaimer.
3. **Polish (8, 11, 12, 13):** Cross-Tab-Sync, Visuals, Error-Boundaries.
4. **Optional (1, 5, 6, 14):** Kommentare/UX-Feinschliff.

Soll ich alles in einem Rutsch fixen, oder nur die Bug-Klasse (Punkt 1)? Bei „alles" ist das ~30 min Arbeit, bei „nur Bugs" ~10 min.
