# Step 16 (erweitert) — Auth fertig + Mahnwesen + Dokumente + Steuertermine

Ziel: Vor Step 17 (Release-ZIP) und Step 18 (Pi-Bootstrap) ist die App **vollständig durchgetestet**. Step 16 wird in **4 Blöcke** gegliedert, die je einzeln im Browser testbar sind. Nach jedem Block kannst du ausgiebig probieren und Korrekturen ansagen, bevor der nächste startet.

---

## Block A — Auth-Reststücke abschließen

Kleines Aufräumen, damit die Auth-Schicht 100 % rund ist.

1. **Tab-Filter Mitarbeiter** in `src/routes/einstellungen.tsx`
   - Owner sieht alle Tabs.
   - Mitarbeiter sieht nur: Firma, SMTP, Erscheinung, E-Mail-Vorlagen, Stundenzettel, Dauerauftrag, Nummernkreise, Vorlagen.
   - Tabs Backup, System-Update, Steuern, Sicherheit, Google Drive sind ausgeblendet.
2. **Lockout-Countdown im LoginForm**
   - Bei 429-Antwort liest der Client `retry-after` und zeigt `„Erneut möglich in 04:32"`, Login-Button bleibt deaktiviert.
3. **Recovery-Code drucken**
   - Print-Button im Setup-Wizard und im Reset-Dialog der Benutzer-Verwaltung.
   - Eigene Druckansicht: Logo + „MyCleanCenter Recovery-Code" + Code groß + Datum + Hinweistext „An sicherem Ort verwahren".
4. **install.sh Setup-URL-Ausgabe**
   - Nach erfolgreichem Healthcheck: `Setup-URL: http://<hostname>:8787/setup?token=<token>` ausgeben, falls `setup.token` noch existiert.
5. **Tests** (`backend/test/`):
   - `auth-recovery.spec.ts`: Code einmal nutzbar, dann ungültig; Rotate invalidiert alten.
   - `auth-rollen.spec.ts`: Mitarbeiter → 403 auf `/system`, `/backup`, `/steuern`, `/benutzer`; Last-Owner-Schutz.

**Akzeptanz Block A**: Mitarbeiter-Login zeigt nur erlaubte Tabs, Lockout-Countdown läuft, Recovery-Code druckbar, Tests grün.

---

## Block B — Mahn-Automatik (UI + Job)

Migration `014_mahn_automatik.sql` existiert bereits. Wir bauen UI und Trigger-Job darauf auf.

### B.1 Einstellungen-Tab „Mahnwesen" (Owner-only)
- Schalter „Automatik aktiv"
- 4 Stufen konfigurierbar (Erinnerung / 1. Mahnung / 2. Mahnung / Inkasso-Vorstufe):
  - Tage nach Fälligkeit
  - Mahngebühr (€)
  - Verzugszinssatz (%) — Default 9 % über Basiszinssatz für B2B
  - Verknüpfte E-Mail-Vorlage (Auswahl aus bestehenden Vorlagen, Kontext „mahnung")
- Globale Optionen: Wochenende überspringen, Mindestbetrag offen (z. B. nur ab 10 €), Pausieren bei aktiver Teilzahlung in den letzten N Tagen

### B.2 Rechnung-Detailseite
- Neuer Bereich „Mahnstatus": aktuelle Stufe, fällig seit X Tagen, nächste Mahnung am …
- Mahn-Verlauf-Liste (Stufe, Datum, Versandstatus, Mahngebühr, neuer Gesamtbetrag)
- Button **„Mahnung jetzt erzeugen"** → Mini-Dialog wählt Stufe → erzeugt Mahn-PDF + Vormerker im E-Mail-Versand (Versand erst nach Bestätigung im E-Mail-Postausgang)

### B.3 Listen-Filter
- Rechnungen-Liste: neue Filter-Chips „Überfällig", „Mahnstufe ≥ 1", „Wartet auf Versand"

### B.4 Backend-Trigger
- Täglicher Job (Cron-ähnlich, in-process) prüft alle offenen Rechnungen.
- Erzeugt Mahn-Vormerker (Status `wartet_auf_freigabe`), KEIN Auto-Versand.
- Bell-Icon im Header zeigt „X Mahnungen warten auf Freigabe" → Klick führt zur gefilterten Liste.

**Akzeptanz Block B**: Du kannst Stufen konfigurieren, eine überfällige Rechnung produziert nach Job-Lauf einen Vormerker, manuelle Mahnung funktioniert, Verlauf wird geführt.

---

## Block C — Dokumenten-Upload UX

Migration `013_dokumente.sql` existiert. Wir bauen die UI komplett aus.

### C.1 Drop-Zone-Komponente
Wiederverwendbar für Kunde, Angebot, Rechnung, Objekt.
- Drag & Drop + Klick-zum-Auswählen + Mobile-Kamera-Capture (`capture="environment"`)
- Mehrfachauswahl, parallele Uploads mit Fortschrittsbalken pro Datei
- Kategorien-Auswahl pro Datei: Vertrag, Lieferschein, Foto, Schlüsselübergabe, Sonstiges
- Max-Größe konfigurierbar (Default 25 MB), erlaubte Typen: PDF, JPG, PNG, HEIC, DOCX

### C.2 Dokumenten-Liste
- Thumbnail-Vorschau (Bild direkt, PDF erste Seite via `pdfjs-dist` Browser-side)
- Aktionen: Öffnen (Fullscreen-Viewer), Herunterladen, Umbenennen, Kategorie ändern, Löschen (mit Bestätigung)
- Sortierung: hochgeladen am (neuste zuerst), Filter nach Kategorie

### C.3 Einbau in Detailseiten
- **Kunde-Detail**: neuer Tab „Dokumente"
- **Angebot-/Rechnung-Detail**: Akkordeon „Dokumente" unter den Positionen
- **Objekt-Detail**: Tab „Dokumente"

### C.4 Backend-Anpassungen
- `/dokumente` Listen-Endpoint mit Filter `kundeId|angebotId|rechnungId|objektId`
- Multipart-Upload bestehende Route nutzen, Limits aus Einstellungen lesen
- Storage-Pfad: `$DATA_DIR/dokumente/{YYYY}/{MM}/{uuid}.{ext}`

**Akzeptanz Block C**: Datei per Drag&Drop + per Handy-Kamera hochladbar, Vorschau funktioniert, Löschen funktioniert, Dokumente erscheinen im richtigen Kontext.

---

## Block D — Steuertermine + Erinnerungen

### D.1 Tab „Steuertermine" im Steuer-Modul
- Liste aller Fristen (USt-VA monatlich, KSt jährlich, GewSt jährlich, eigene manuelle Termine)
- Spalten: Termin, Steuerart, Zeitraum, Sollbetrag (geschätzt), Status (offen / erledigt / überfällig)
- Aktion „Als erledigt markieren" → Frist-Log-Eintrag mit Datum + Notiz + optional Beleg-Anhang
- Aktion „Manuellen Termin anlegen"

### D.2 Frist-Log
- Migration `015_steuer_frist_log.sql` ist da — wir bauen die Read/Write-Endpoints + UI.
- Audit-Trail: wann wurde was als erledigt gemeldet, von wem, mit welchem Betrag.

### D.3 Benachrichtigungen
- In-App: Bell-Icon-Eintrag 7 Tage und 1 Tag vor Frist → Klick führt zum Termin.
- Optional E-Mail an Owner-Adresse via SMTP (Schalter in Steuer-Einstellungen).
- Wiederkehrende Termine (USt-VA monatlich) werden automatisch nach Erledigung für nächste Periode neu angelegt.

**Akzeptanz Block D**: Du siehst alle anstehenden Fristen, kannst sie abhaken, Frist-Log wird geführt, Bell-Icon zeigt 7 Tage vor Frist eine Erinnerung.

---

## Reihenfolge & Strategie

```text
A (klein, ~1 Lauf)  ── du testest Auth & Tabs ──┐
B (mittel, ~2 Läufe) ── du testest Mahnwesen ──┤
C (mittel, ~2 Läufe) ── du testest Upload UX ──┤
D (mittel, ~1-2 Läufe) ── du testest Termine ──┘
                                                ↓
                                       Step 17 (Release-ZIP)
                                       Step 18 (Pi-Bootstrap)
```

**Begründung der Reihenfolge:**
- **A zuerst**, weil klein und Voraussetzung für saubere Owner/Mitarbeiter-Trennung in B/C/D.
- **B vor C**, weil Mahn-Automatik bestehende Rechnungen-/E-Mail-Logik berührt — vor neuen Komponenten klären.
- **C vor D**, weil Dokumenten-Upload als Anhang in Steuer-Termine wiederverwendet werden kann.
- **D zuletzt**, weil unabhängiges Modul, baut nur auf bestehender Bell-Icon-Infrastruktur auf.

Nach jedem Block: ich melde mich kurz „Block X fertig — bitte testen", du sagst „weiter" oder nennst Korrekturen.

---

## Was nicht enthalten ist

- 2FA / TOTP — späterer Step
- E-Mail-basierter Passwort-Reset — Recovery-Code reicht
- Buchhaltungs-Export (DATEV) — eigener späterer Step
- OCR auf hochgeladenen Belegen — eigener späterer Step

---

## Technische Details (für mich, du musst das nicht lesen)

**Block A:** TanStack-Router-Filter im Tab-Array per `istOwner`-Check; `retry-after`-Parser im `apiClient`-Interceptor; Print-Route als versteckte `/print/recovery?code=…` mit `window.print()` in `useEffect`.

**Block B:** neue Tabellen `mahn_einstellungen`, `mahn_lauf` (existieren via Migration 014); In-Process-Cron via `setInterval` + Persistenz „letzter Lauf" in `system_state`; PDF-Render nutzt vorhandenes Beleg-Template mit Mahn-Variante.

**Block C:** `react-dropzone` (bereits gängig), `pdfjs-dist` für PDF-Thumbnails; Backend Multipart via `@fastify/multipart` (bereits installiert); Storage als Hash-Pfad zur Deduplizierung optional.

**Block D:** Termin-Generator ist reine Date-Math (USt-VA: 10. des Folgemonats, mit Dauerfristverlängerung +1 Monat); Bell-Icon nutzt bestehende `benachrichtigungen`-Tabelle aus Migration 010.

---

**Sag „los Block A", dann starte ich.**
