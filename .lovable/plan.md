## Ziel
Der QR-Code soll auf dem Handy nach Foto-/Dateiauswahl sofort eine sichtbare Kachel anzeigen, den Upload eindeutig starten/abschließen und die Datei kurz danach live im Laptop-/PC-Dialog anzeigen.

## Gefundene Ursache
Die bereits verbesserte Handy-Upload-Version wurde versehentlich in `src/routes/m.upload..tsx` eingebaut. Der QR-Code öffnet aber `/m/upload/:session` und nutzt damit weiterhin `src/routes/m.upload.$session.tsx` — dort ist noch die alte Version mit manuellem Button und weniger robuster Logik aktiv.

## Plan
1. **Richtige Handy-Route ersetzen**
   - Die funktionierende Queue-/Progress-Logik aus `src/routes/m.upload..tsx` wird nach `src/routes/m.upload.$session.tsx` übertragen.
   - Danach ist genau die vom QR-Code geöffnete Seite repariert.

2. **Doppel-/Fehlroute entfernen**
   - `src/routes/m.upload..tsx` wird entfernt, damit es keine zweite falsche `/m/upload/`-Route mehr gibt.
   - `src/routeTree.gen.ts` wird nicht manuell gepflegt; der Router generiert sie selbst neu.

3. **Handy-Seite klar und zuverlässig machen**
   - Nach Foto/Galerie-Auswahl erscheint sofort eine Vorschau-Kachel auf dem Handy.
   - Jede Kachel zeigt Status: wartet, lädt hoch, fertig oder Fehler.
   - Fehler-Kacheln bekommen „Erneut“-Aktion.
   - Unten bleibt eine feste Leiste mit Fortschritt und einem klaren Button.
   - Zusätzlich wird Auto-Upload beibehalten, aber der Button bleibt als sichtbare Sicherheit/Bestätigung erhalten.

4. **Upload technisch stabilisieren**
   - `uploadDokumentToSessionMitProgress` wird in der QR-Code-Route genutzt.
   - Maximal 2 Uploads parallel, automatische Wiederholung bei temporären Limits.
   - Nach erfolgreichem Upload bleibt die Handy-Vorschau sichtbar und zeigt „fertig“ statt zu verschwinden.

5. **Laptop-/PC-Live-Anzeige absichern**
   - Der bestehende Polling-Dialog bleibt aktiv und zeigt neue Dateien sofort nach erfolgreichem Backend-Speichern.
   - Falls nötig wird der Live-Hook so angepasst, dass er bei offener Sitzung zuverlässig jede Sekunde nachlädt.

6. **Verifikation**
   - Prüfen, dass der QR-Code exakt `/m/upload/{token}` öffnet.
   - Prüfen, dass die reparierte Route dort registriert ist.
   - Code-seitig sicherstellen, dass Fotoauswahl → Handy-Kachel → Upload → Backend-Dokument → Laptop-Liste in einer Kette verbunden ist.

## Ergebnis
Nach Umsetzung fühlt sich der Ablauf so an:

```text
Laptop: QR-Code offen
Handy: QR-Code scannen
Handy: Foto auswählen/aufnehmen
Handy: Bild erscheint sofort als Kachel
Handy: Upload startet und zeigt Fortschritt
Handy: Kachel wird grün/fertig
Laptop: Datei erscheint automatisch im Dialog
```

## Technische Dateien
- `src/routes/m.upload.$session.tsx`
- `src/routes/m.upload..tsx` entfernen
- ggf. `src/hooks/useApi.ts` nur falls Live-Polling noch nicht zuverlässig genug ist