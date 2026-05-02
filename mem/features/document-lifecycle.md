---
name: Document Lifecycle (Angebot & Rechnung)
description: Status-Übergänge, automatisch vs. manuell, FlowBar-Visualisierung
type: feature
---

# Document Lifecycle

## Rechnung
```
entwurf ──(versenden)──▶ versendet ──┬──▶ teilbezahlt ──▶ bezahlt
                                     ├──▶ bezahlt
                                     ├──▶ überfällig (Cron, fällig + N Tage)
                                     └──▶ inkasso (manuell)
```
- `entwurf → versendet`: manuell (Versand-Button) ODER automatisch wenn Mail erfolgreich
- `versendet → teilbezahlt/bezahlt`: **automatisch** aus Zahlungssumme
- `versendet → überfällig`: automatisch via Cron (täglich), berücksichtigt Mahnung-Pausierungs-Flag
- `* → inkasso`: nur manuell

## Angebot
```
entwurf ──▶ versendet ──┬──▶ angenommen ──(in-rechnung-umwandeln)──▶ konvertiert
                        ├──▶ abgelehnt
                        └──▶ abgelaufen (Cron, gültig_bis erreicht)
```
- Konvertierung kopiert Positionen, vergibt neue Belegnummer für Rechnung, verlinkt `quelle_angebot_id`

## FlowBar (Frontend, existiert)
- 3 Größen: lg (Detailseite), sm (Listen), mini (Inline)
- Nächster logischer Schritt = prominenter Primary-Button

## Backend-TODOs (Steps 4 & 7)
- Status-Übergänge in Service-Layer, nicht in Routes
- Jeder Übergang erzeugt Eintrag in `aktivitaeten`
- Sicherheitsrelevante Übergänge (Inkasso) zusätzlich in `audit_log`
