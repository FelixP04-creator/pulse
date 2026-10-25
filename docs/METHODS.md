# Methoden und Formeln

Alle Modelle sind **app-eigen, transparent und nicht klinisch validiert**. Sie sind in `src/core/` implementiert und getestet. Bei fehlenden Daten wird **kein** Score berechnet („Nicht genügend Daten“).

## Persönliche Basis (`baselines.ts`)
Median und robuste Streuung (MAD·1,4826) der letzten 60 Tage **vor** dem betrachteten Tag, nur plausible Werte, mindestens 14 gültige Werte. Streuung hat Untergrenzen (z. B. 1,5 bpm Ruhepuls), z-Werte werden auf ±3 begrenzt.
Plausibilitätsbereiche dienen nur der Artefakterkennung (z. B. Ruhepuls 25–140), nicht der Bewertung.

## Recovery (`recovery.ts`)
`Score = 0,40·HRV + 0,25·Ruhepuls + 0,25·Schlafdauer + 0,10·Regelmäßigkeit` (fehlt die Regelmäßigkeit, werden Gewichte umverteilt).
HRV-Teil = 50 + 20·z, Ruhepuls-Teil = 50 − 20·z (z auf ±2,5 begrenzt), Schlaf-Teil = Schlafzeit/Bedarf·100 (max. 100).
Bänder: <34 niedrig, <67 mittel, sonst hoch – relativ zur eigenen Basis.

## Schlaf (`sleep.ts`)
Dauer 60 % · Regelmäßigkeit 25 % (σ von Bett- und Aufwachzeit über 14 Tage, ≥5 Nächte; 100·(1−σ/90 min)) · Effizienz 15 % (nur wenn die Quelle die tatsächliche Schlafzeit liefert).
Bedarf: persönliches Ziel > Altersempfehlung (<18: 9 h, 18–64: 8 h, ≥65: 7,5 h) > 8 h. Defizit: Summe der Unterschreitungen in 7 Tagen (≥4 Nächte).

## Belastung 0–21 (`strain.ts`)
Edwards-TRIMP: Σ Minuten in Zone i · i (Zonen nach % der Herzfrequenzreserve: 50/60/70/80/90 %). Ohne Zonen: Dauer·RPE·0,5 (als Schätzung gekennzeichnet). `Strain = 21·(1 − e^(−Last/250))`. **Nicht mit WHOOP vergleichbar.** Alltagsaktivität zählt nicht mit.

## Vitalitätsindex 0–100 (`vitality.ts`)
Gewohnheiten (60 %): Schlafregelmäßigkeit 20, Schlafdauer 15, Alltagsbewegung 25 (Ø aktive Minuten/Woche gegen 150). Entwicklung (40 %): Ruhepuls 15, HRV 15, VO₂max 10 (28-Tage-Median gegenüber den 90 Tagen davor). Fehlendes → Umverteilung. Unsicherheit ±(5 + 15·(1−Abdeckung)) als Heuristik. **Kein biologisches Alter.**
Der „Physiologische Altersindikator“ liefert nur mit einem eingebundenen, zitierten, validierten Modell und vollständigen Eingaben einen Wert – standardmäßig gibt es keins.

## Ernährung
- **Datenbank** (`nutrition.ts`): Richtwerte pro 100 g für typische Produkte (Größenordnung USDA/BLS), keine Laborwerte. Referenz für Mikronährstoffe: EU-Nährstoffbezugswerte.
- **Rating** (`foodRating.ts`): Protein 20 %, Ballaststoffe 15 %, Mikronährstoffe 30 %, Verarbeitungsgrad 15 %, zugesetzter Zucker 10 %, gesättigte Fette 10 % → 1–5 Sterne. Keine Bewertung unter 30 kcal.
- **Bioverfügbarkeit** (`bioavailability.ts`): qualitative Regeln zu Förderern/Hemmern (Häm-/Nicht-Häm-Eisen, Vitamin C, Phytat, Oxalat, Polyphenole, Fett und fettlösliche Vitamine, Garen, Rohverzehr). Keine berechneten „aufgenommenen mg“.
- **Perspektiven** (`foodRating.ts`): Übereinstimmung mit Ray Peat bzw. Aajonus Vonderplanitz laut gängiger Zusammenfassungen; immer mit Hinweis auf die Studienlage (nicht belegt/umstritten) und – bei rohen tierischen Lebensmitteln – auf das Infektionsrisiko. „Mace Woodville / eigene Regeln“ nur nach eigenen Regeln der Nutzerin/des Nutzers.
- **Foto-Erkennung** (`foodAnalysis.ts`): Die Modellantwort ist untrusted Input. Bekannte Lebensmittel nutzen Datenbankwerte, Modellwerte nur nach Plausibilitätsprüfung (Energie ≈ Makros) mit Warnung; Gewichte sind Schätzungen und editierbar.

## Tipps / Coach
Jeder Tipp trägt eine Evidenzstufe (gut belegt · teilweise · erste Hinweise · spekulativ). Keine Dosierungen, keine Medikamente. Notfall- und Suizid-Formulierungen führen sofort zu Hilfehinweisen (112, Telefonseelsorge 0800 111 0 111) und werden nie an ein Modell delegiert.
