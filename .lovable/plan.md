## Ziel

Beim nächsten System-Update soll für jedes E-Mail-Szenario eine professionelle, menschlich klingende Standard-Vorlage automatisch installiert sein, mit korrekten Platzhaltern für Kunde, **Ansprechpartner**, Beleg, Firma und Mahnung. Keine Gedankenstriche („–"), keine Trenn-Bindestriche („Wort - Wort"). Bestehende, vom User editierte Vorlagen werden nie überschrieben.

## Aktueller Stand (Probleme)

1. Die im Code stehenden Defaults nutzen `{{beleg.nummer}}` / `{{kunde.anrede}} {{kunde.nachname}}`, das **funktioniert gar nicht** mit dem Frontend-Renderer (`replacePlaceholders`), der nur `angebot.*`, `rechnung.*`, `kunde.*`, `firma.*`, `mahnung.*` kennt. Im UI bleiben die Tokens stehen.
2. `seedDefaultVorlagen()` existiert, wird aber **nie aufgerufen**. Frische Installationen haben null Vorlagen.
3. `PlaceholderContext` kennt keinen `ansprechpartner` — obwohl der Versanddialog seit kurzem den Ansprechpartner ermittelt.
4. Es gibt keine Versionierung. Updates können daher keine neuen Default-Vorlagen nachliefern.

## Lösung

### 1. Platzhalter-System erweitern (`src/lib/email/placeholders.ts`)

Neuen Block in `flatten()` für den ausgewählten Ansprechpartner. Felder:

- `ansprechpartner.anrede`   ("Herr"/"Frau"/"")
- `ansprechpartner.vorname`
- `ansprechpartner.nachname`
- `ansprechpartner.name`     (Vorname + Nachname, getrimmt)
- `ansprechpartner.position`
- `ansprechpartner.email`
- `ansprechpartner.telefon`

Plus „Smart-Anrede": `anrede.zeile` wird zu

- „Sehr geehrter Herr Müller," wenn Ansprechpartner mit Anrede vorhanden,
- sonst „Sehr geehrte Damen und Herren,".

Zusätzlich `firma.adresse` (Straße, PLZ Ort einzeilig), `firma.webseite`, `firma.geschaeftsfuehrer`, `firma.bankName`, `firma.bic`. `ALLE_PLATZHALTER`-Liste entsprechend ergänzen (für die UI-Hilfe).

Neuer `PlaceholderContext`-Eintrag:
```ts
ansprechpartner?: Ansprechpartner | null;
```

### 2. Versanddialog reicht den Ansprechpartner durch (`src/components/email/EmailVersandDialog.tsx`)

Der Dialog ermittelt den Ansprechpartner bereits (für die „An"-Vorbelegung). Diesen Wert zusätzlich in den `PlaceholderContext` (`ctx`) packen, damit Vorlagen `ansprechpartner.*` und `anrede.zeile` rendern können. Keine Verhaltensänderung sonst.

### 3. Versioniertes Seeden im Backend

#### 3a. Migration `010_email_vorlage_seedkey.sql`

```sql
ALTER TABLE email_vorlage ADD COLUMN seed_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_email_vorlage_seedkey ON email_vorlage(seed_key) WHERE seed_key IS NOT NULL;
```

`seed_key` ist der stabile Schlüssel pro Default-Vorlage (z. B. `angebot.standard`). User-eigene Vorlagen haben NULL.

#### 3b. `backend/src/email/templates.ts`

- `EmailVorlage` + Row-Mapper um optionales `seedKey` ergänzen, INSERT/UPDATE schreiben es mit.
- `DEFAULTS` neu schreiben (siehe Abschnitt 4) — jeder Eintrag mit `seedKey`.
- `seedDefaultVorlagen()` ersetzen durch `seedOrUpdateDefaultVorlagen()`:
  - Für jede Default-Vorlage: `INSERT INTO email_vorlage (..., seed_key) ON CONFLICT(seed_key) DO NOTHING`.
  - **Niemals UPDATE** auf bestehende Vorlagen — User-Änderungen bleiben unangetastet.
  - Wenn pro Kontext noch keine `ist_standard=1`-Vorlage existiert, die soeben eingefügte Default als Standard setzen.

#### 3c. `backend/src/server.ts`

Nach `openDatabase(...)` und Integrity-Check `seedOrUpdateDefaultVorlagen()` aufrufen. Idempotent, fehlertolerant (Try/Catch mit Log, kein Boot-Abbruch).

### 4. Inhalt der Default-Vorlagen

Tonalität: kurze Sätze, höflich, professionell, menschlich. **Keine** „–" (Gedankenstrich) und **keine** „-" als Trenner zwischen Wörtern. Bindestriche in Komposita („E-Mail", „MwSt.-Satz") bleiben, das ist orthographisch korrekt. Anrede über `{{anrede.zeile}}` (fällt automatisch auf „Damen und Herren" zurück). Signatur wird **nicht** in den Body geschrieben (User hat eigene Signaturen).

Vorlagenliste (alle mit `seedKey`):

| seedKey | Kontext | Name | Zweck |
|---|---|---|---|
| `angebot.standard` | angebot | Angebot Versand | Standard beim Versenden eines Angebots |
| `angebot.nachfass` | angebot | Angebot Nachfassen | Freundliche Erinnerung an offenes Angebot |
| `angebot.auftragsbestaetigung` | angebot | Auftragsbestätigung | Nach Annahme des Angebots |
| `rechnung.standard` | rechnung | Rechnung Versand | Standard beim Versenden einer Rechnung |
| `rechnung.erinnerung` | rechnung | Zahlungserinnerung freundlich | Vor offizieller Mahnung |
| `rechnung.zahlungseingang` | rechnung | Zahlungseingang Bestätigung | Nach vollständiger Zahlung |
| `mahnung.stufe1` | mahnung | Mahnung Stufe 1 | Erste Mahnung mit `mahnung.*` |
| `mahnung.stufe2` | mahnung | Mahnung Stufe 2 | Zweite Mahnung |
| `mahnung.stufe3` | mahnung | Mahnung Stufe 3 letzte | Letzte Mahnung mit Hinweis Inkasso |
| `allgemein.anfrage` | allgemein | Allgemeine Anfrage | Freier Geschäftskontakt |
| `allgemein.danke` | allgemein | Dankesnachricht | Allgemeine Danke-Mail |

Beispielhafte Formulierung (Angebot Versand):
> Betreff: `Ihr Angebot {{angebot.nummer}} von {{firma.name}}`  
> Body:  
> `<p>{{anrede.zeile}}</p>`  
> `<p>vielen Dank für Ihr Interesse an unseren Leistungen. Im Anhang finden Sie unser Angebot <strong>{{angebot.nummer}}</strong> über {{angebot.summe}} brutto, gültig bis {{angebot.gueltigBis}}.</p>`  
> `<p>Wir haben den Auftrag genau auf Ihre Anforderungen abgestimmt. Sollten Sie Fragen haben oder Anpassungen wünschen, melden Sie sich jederzeit gerne telefonisch unter {{firma.telefon}} oder per Antwort auf diese E-Mail.</p>`  
> `<p>Wir freuen uns auf Ihre Rückmeldung und auf eine gute Zusammenarbeit.</p>`  
> `<p>Mit freundlichen Grüßen<br>Ihr Team von {{firma.name}}</p>`

Entsprechend professionell formuliert für alle anderen Szenarien (jeweils 3 bis 5 kurze Absätze, ohne Strich-Trenner).

### 5. Update-Verhalten

- Frische DB: alle Defaults werden eingefügt, jeweils erste pro Kontext wird Standard.
- Bestehende Installation mit eigenen Vorlagen: neue Defaults werden hinzugefügt (sofern `seed_key` noch nicht existiert), eigene Vorlagen bleiben unverändert. Standard-Markierung wird **nicht** geändert.
- User editiert eine Default-Vorlage: `seed_key` bleibt erhalten, `ON CONFLICT DO NOTHING` lässt sie in Ruhe.

### 6. Out of Scope

- Frontend-UI für Vorlagenverwaltung bleibt unverändert.
- Signaturen (User hat eigene).
- Keine Änderung an SMTP, an `email_versand`-Pipeline, an Mahn-Cron.

## Verifikation

1. Migration läuft, Spalte `seed_key` existiert.
2. Backend-Boot loggt „Email-Vorlagen seed: X eingefügt, Y bereits vorhanden".
3. Vorlagen-Liste in Einstellungen zeigt alle 11 Vorlagen, gruppiert nach Kontext.
4. Versanddialog → Vorlage „Rechnung Versand" → Vorschau zeigt korrekt aufgelöste Tokens (Ansprechpartner-Anrede, Rechnungsnummer, Summe, Fälligkeit), keine `{{...}}`-Reste.
5. Eine User-editierte Vorlage übersteht einen Neustart unverändert (kein Overwrite).
