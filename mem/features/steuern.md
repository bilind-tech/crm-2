---
name: Steuer-Modul (GmbH Sankt Augustin)
description: 3 automatische Hauptsteuern + manuelle Termine, Rücklage-Widget, Disclaimer
type: feature
---

# Steuern (Step 10)

## Kontext
GmbH Sankt Augustin. **Reine Reinigung/Wartung — keine §48 Bauleistungen.**

## 3 automatische Hauptsteuern

### Umsatzsteuer
- 19% (Standard), 7% (ermäßigt)
- Aus Rechnungspositionen aggregiert
- Quartalsweise Voranmeldung

### Körperschaftsteuer + Solidaritätszuschlag
- KSt: 15% vom Gewinn
- Soli: 5,5% auf KSt → effektiv 0,825% vom Gewinn
- Zusammen: 15,825% vom Gewinn

### Gewerbesteuer
- Hebesatz Sankt Augustin: 525%
- Messzahl: 3,5%
- Effektiv: 3,5% × 525% = 18,375% vom Gewinn

## Effektive Gesamtbelastung
KSt + Soli + GewSt = 15,825% + 18,375% = **34,20% vom Gewinn**
→ **Empfohlene Rücklage: 35%** (kleiner Sicherheitspuffer)

## Datenmodell (Step 10)
```sql
CREATE TABLE steuer_einstellungen (
  hebesatz_gewerbesteuer INTEGER DEFAULT 525,   -- konfigurierbar
  ust_satz_standard      REAL    DEFAULT 19,
  ust_satz_ermaessigt    REAL    DEFAULT 7,
  ruecklage_prozent      REAL    DEFAULT 35
);
CREATE TABLE steuer_termine (...);
CREATE TABLE steuer_berechnungen (...);
```

## Restliche Steuerarten
Als manuelle Termine (Lohnsteuer, etc.) — kein Auto-Calc.

## Disclaimer (Pflicht in UI)
„Schätzung — keine Steuerberatung. Verbindliche Berechnung durch Steuerberater."
