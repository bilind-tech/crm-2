## Problem

Auf den Detailseiten von Angebot und Rechnung steht unten links der Block „E-Mail-Versand". Der listet aktuell **jeden einzelnen Versuch** als eigene Zeile auf — bei mehrfachem Senden / Mahnungen / Retries wird das schnell eine sehr lange, unübersichtliche Liste, die für den Alltag null Mehrwert hat.

Der User will dort nur **eine kompakte Status-Aussage**:

| Zustand | Anzeige |
|---|---|
| Noch nie versendet | „Noch nicht versendet" |
| Mindestens einmal erfolgreich versendet | „E-Mail versendet" + Datum/Uhrzeit der **letzten** erfolgreichen Mail |
| Letzter Versuch fehlgeschlagen (kein erfolgreicher Versand danach) | „Versand fehlgeschlagen" + Fehlertext + Retry-Button |

Die volle Versand-Historie (jede einzelne Mail) bleibt im System erhalten und ist weiterhin über die zentrale Aktivitäts-/Versand-Liste auffindbar — sie wird nur **nicht mehr** auf den Beleg-Detailseiten ausgebreitet.

## Umsetzung

Rein Frontend, keine Backend-/API-/Datenmodell-Änderung nötig.

### 1. `src/components/email/EmailVersandHistorie.tsx` umbauen → `EmailVersandStatus` (kompakt)

Statt der `<ul>`-Auflistung:

- Daten weiterhin via `useEmailVersand({ belegId, belegTyp })` holen.
- Aus der Liste ableiten:
  - `letzterErfolg` = neueste Zeile mit `status === "gesendet"` (sortiert nach `versendetAm`/`erstelltAm`)
  - `letzterVersuch` = chronologisch neueste Zeile insgesamt
  - `hatOffenenFehler` = `letzterVersuch.status === "manuell"` UND (kein `letzterErfolg` ODER `letzterVersuch` neuer als `letzterErfolg`)
  - `wirdGesendet` = `letzterVersuch.status === "sending"` oder `"pending"` (ohne neueren Erfolg)

- Render genau **eine** Zeile in der bestehenden Card-Hülle (`rounded-2xl border border-border bg-card p-5`), Header bleibt „E-Mail-Versand":
  - **Leere Liste** → schlicht: „Noch nicht versendet" (muted-foreground), kein Icon-Schmuck.
  - **Erfolg, kein neuer Fehler danach** → Success-Pill „E-Mail versendet" + sekundär klein „am {formatDateTime(versendetAm)}". Keine Empfänger, keine Anhänge-Zähler, kein Betreff.
  - **Wird gerade gesendet** → Loader-Pill „Wird gesendet …".
  - **Letzter Versuch fehlgeschlagen** → Destructive-Pill „Versand fehlgeschlagen" + Fehlertext (`fehlerText`, max 2 Zeilen, `line-clamp-2`) + kleiner sekundär-Button „Erneut senden" (ruft existierende `/email/versand/:id/retry`-Mutation auf — Hook prüfen: `useRetryVersand` o. ä. in `useApi`; falls nicht vorhanden, einfaches `api.post` inline).

- Komponente bleibt rückwärtskompatibel exportiert (`EmailVersandHistorie` als Alias / Re-Export), damit die Imports in `angebote.$id.tsx` und `rechnungen.$id.tsx` unverändert bleiben.

### 2. Keine Änderung an

- `src/routes/angebote.$id.tsx` — Einbindung bleibt.
- `src/routes/rechnungen.$id.tsx` — Einbindung bleibt.
- Backend-Routen, `useApi`-Hooks für `useEmailVersand` (filtert bereits per `belegId`).
- Aktivitäts-Stream / SSE — die volle Historie bleibt dort sichtbar.

### 3. Verhalten gegenüber dem Beleg-Status

Der jetzt erst saubere Beleg-Status (`status='versendet'`, gerade gefixt) wird hier **nicht** als alleinige Wahrheit verwendet — die Anzeige stützt sich weiter auf die `email_versand`-Zeilen, weil sie die einzige Quelle für „letzte Mail erfolgreich vs. mit Fehler" ist. Damit bleibt z. B. ein erneuter manueller Versand einer bereits-versendeten Rechnung sauber sichtbar (zuletzt erfolgreich → grüner Status).

## Out of scope

- Komplettes Verschwinden der Card, wenn nichts versendet wurde — der User will explizit „Noch nicht versendet" als Indikator sehen.
- Zentrale Versand-Liste (`/aktivitaet` o. ä.) — bleibt unverändert mit voller Historie.
- Mahn-Stufen-Anzeige im Beleg — bleibt wo sie heute ist.
