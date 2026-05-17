Ziel: Beim Erstellen und Bearbeiten von Übergabeprotokoll und Schlüsselübergabe darf die PDF-Vorschau nicht mehr flackern, und die rechte Bearbeitung wird klarer, weil „Stammdaten“ und „Inhalt“ nicht mehr doppelt denselben Inhalt anzeigen.

Plan:

1. PDF-Flackern wirklich abstellen
- Die Protokoll-PDF wird beim Tippen nicht mehr sofort bei jedem Zeichen neu in die sichtbare Vorschau getauscht.
- Die bestehende PDF bleibt stabil sichtbar, bis die neue PDF vollständig im Hintergrund geladen ist.
- Falls während eines PDF-Builds weitere Eingaben kommen, wird danach garantiert der neueste Stand gebaut, statt dass Updates verloren gehen oder gegeneinander laufen.
- Der Ladehinweis bleibt dezent und darf die PDF nicht ständig neu mounten.

2. Ursache für Flacker-Loop entschärfen
- Die Vorschau bekommt eine stabile PDF-Quelle, damit React-PDF/PDF.js nicht bei unnötigen State-Änderungen neu startet.
- `loadAttempt` wird nur noch für echte Fehler-Retry-Fälle genutzt, nicht als normaler Re-Render-Auslöser.
- Pending-PDFs werden mit einem stabilen Schlüssel geladen, damit gleiche Dateigrößen nicht zu falschen Swaps oder Wiederholungen führen.
- Objekt-URLs und Buffer werden sauber aufgeräumt, ohne die sichtbare Vorschau während der Eingabe kurz leer zu machen.

3. „Stammdaten“ und „Inhalt“ zusammenlegen
- Der doppelte Tab wird entfernt.
- Es bleibt ein klarer Haupttab, z. B. „Inhalt“, der Kunde/Objekt, Datum/Uhrzeit und die eigentlichen Protokolldaten enthält.
- Hotspot-Klicks auf Kunde/Meta springen auf diesen Haupttab.
- Tabs danach: „Inhalt“, „Unterschriften“, „Optionen“.

4. Inline-Bearbeitung bleibt kompatibel
- Hotspots in der PDF öffnen weiter die passenden kleinen Editoren.
- Schlüssel-Liste, Pfand, Leistungsumfang, Bemerkungen und Unterschriften bleiben direkt bearbeitbar.
- Der rechte Editor bleibt übersichtlich als Fallback für vollständige Bearbeitung.

Technische Umsetzung:
- Anpassen von `ProtokollLivePreview.tsx`: Build-Queue/latest-key, stabilere `fileSource`-Memoisierung, atomarer Pending-Swap, sauberer Retry-Key.
- Anpassen von `ProtokollEditorLayout.tsx`: Tab-Typ und Tabs vereinfachen; doppelte `TabsContent` entfernen; Hotspot-Mapping berücksichtigen.
- Anpassen von `fieldMap.ts`: Protokoll-Tabs von `stammdaten|inhalt|...` auf die neue Struktur mappen.
- Falls nötig kleine Korrektur in `useProtokollPdf.ts`, damit PDF-Erstellung außerhalb des Editors ebenfalls nicht unnötig durch volatile/context-Referenzen neu startet.

Validierung:
- Prüfen, dass Übergabeprotokoll und Schlüsselübergabe beim Tippen die sichtbare PDF stabil behalten.
- Prüfen, dass der entfernte doppelte Tab keine Hotspot-Navigation kaputt macht.
- Prüfen, dass Abschließen weiterhin die finale PDF mit dem neuesten Draft erzeugt.