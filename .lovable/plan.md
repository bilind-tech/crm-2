## Stand jetzt

Bereits erledigt:
- Mahn-System komplett entfernt (Frontend + Backend-Dateien gelöscht, Imports bereinigt, Build grün).
- Neue Bausteine vorhanden: `src/lib/erinnerung/regeln.ts`, `src/hooks/useErinnerungsKandidaten.ts`, `src/components/notifications/ErinnerungsPopup.tsx` (eingebunden in `__root.tsx`).
- Backend-Vorlage `rechnung.erinnerung` ist als Seed vorhanden.

Was noch fehlt (das gehen wir Schritt für Schritt durch):

---

### Schritt 1 — Backend-Setting „Tage nach Fälligkeit"
- In `backend/src/settings/schemas.ts` neues schmales Schema `erinnerung` ergänzen: `{ tageNachFaelligkeit: number, min 1, max 60, default 14 }`.
- In `backend/src/routes/einstellungen.ts` zwei Endpoints (`GET` und `PUT /einstellungen/erinnerung`) analog zu den anderen Settings.
- Im Frontend `useApi.ts` Hooks `useErinnerungsEinstellungen` + `useErinnerungsEinstellungenSpeichern` ergänzen.
- `useErinnerungsKandidaten` liest dann den Wert aus dem Hook statt Default.

### Schritt 2 — Settings-UI im E-Mail-Tab
- In `src/components/email/EmailEinstellungen.tsx` ganz unten neue Sektion „Zahlungserinnerungen":
  - Slider/Input 1–60 Tage, Default 14, mit Live-Speicherung
  - Klarer Hinweis: „Erinnerungen werden nur vorgeschlagen — nie automatisch gesendet."

### Schritt 3 — Dashboard-Karte „Zahlungserinnerungen"
- Neue Komponente `src/components/dashboard/ZahlungserinnerungenCard.tsx`:
  - Zeigt Anzahl + Summe offen
  - Listet bis zu 3 dringendste Kandidaten (Kunde, Rechnungsnummer, X Tage über fällig, offener Betrag)
  - Jede Zeile mit Inline-Button „Erinnern" → öffnet `EmailVersandDialog`
  - Wenn 0 Kandidaten: dezenter „Alles bezahlt"-Zustand
- In `src/routes/index.tsx` an passender Stelle einsetzen (an der Position, wo vorher die Mahn-Karte saß).

### Schritt 4 — Rechnungsliste mit „Erinnern"-Button
- In `src/routes/rechnungen.tsx`: pro Zeile, wenn `erinnerungsReif`, ein kleiner amberfarbener Pill „Erinnerung empfohlen" + Icon-Button „Erinnern" neben der E-Mail-Aktion.
- Aggregation über `useErinnerungsKandidaten` + `indexKandidaten()`.

### Schritt 5 — Rechnungs-Detailseite mit Hinweisstreifen
- Neue 30-Zeilen-Komponente `src/components/rechnungen/ErinnerungsHinweis.tsx`:
  - Dezenter amberfarbener Streifen oben: „Seit X Tagen offen — Erinnerung empfohlen"
  - Primary-Button „Erinnerung senden" → öffnet `EmailVersandDialog` mit der `rechnung.erinnerung`-Vorlage vorbelegt
- In `src/routes/rechnungen.$id.tsx` an der Stelle einsetzen, wo vorher `<MahnSektion>` stand.

### Schritt 6 — Smoke-Test
- Beim App-Start zeigt das Popup oben rechts genau dann etwas, wenn eine Rechnung erinnerungsreif ist.
- Setting-Änderung wirkt sofort (Query-Invalidate).
- Klick auf „Erinnern" überall öffnet den E-Mail-Dialog vollständig ausgefüllt mit der freundlichen Erinnerungs-Vorlage und PDF-Anhang. Versand nur per Klick (Memory-Regel).

---

Sag „los" und ich fange mit **Schritt 1** an.