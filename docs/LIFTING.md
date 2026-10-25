# Science-based Lifting – Methodik und Grenzen

Umsetzung in `src/core/lifting.ts` (Tests: `tests/lifting.test.ts`), Screen `app/lifting.tsx`.
Alles sind **Orientierungswerte für gesunde Erwachsene**, keine individuelle Trainings- oder medizinische Beratung.

## Was berechnet wird
| Funktion | Regel | Einordnung |
|---|---|---|
| Harter Satz | Arbeitssatz (kein Aufwärmsatz) mit RIR ≤ 4 (fehlende RIR zählt, ist aber eine Annahme) | Konvention |
| Wochenvolumen | 7 Tage; direkte Sätze zählen 1,0, Hilfsmuskeln 0,5 | Zählkonvention, kein Naturgesetz |
| Volumenbereich | < 6 wenig · 6–20 üblicher Zielbereich · > 20 sehr viel | grobe Richtwerte, moderat belegt |
| e1RM | Epley: Gewicht · (1 + (Wdh. + RIR) / 30), nur bis 12 Wdh. | Schätzung, kein Maximaltest |
| Progression | Doppelte Progression: obere Wdh.-Grenze bei RIR ≤ 2 in allen Sätzen (mind. 2) → Last + kleinste Stufe; sonst +1 Wdh. | Heuristik |
| Deload-Hinweis | nur bei ≥ 2 Gründen (niedrige Erholung im 7-Tage-Schnitt, sinkende e1RM bei ≥ 2 Übungen) | Heuristik ohne feste Studiengrundlage |
| Belastung | Dauer × Ø-RPE (10 − RIR) · 0,5, als „geschätzt“ markiert; ohne Dauer oder RIR keine Belastung | wie übrige Belastung |

## Quellenlage (zum Nachlesen, bitte selbst prüfen)
- Volumen und Dosis-Wirkung: Meta-Analyse von Schoenfeld, Ogborn & Krieger (2017, Journal of Sports Sciences).
- Trainingsfrequenz: Schoenfeld, Ogborn & Krieger (2016, Sports Medicine).
- Protein: Morton et al. (2018, British Journal of Sports Medicine) – etwa 1,6 g/kg/Tag.
- Wiederholungsbereiche: Schoenfeld et al. (2017, Journal of Strength and Conditioning Research).
Die Literatur entwickelt sich weiter; exakte Zahlen können abweichen. Die Quellen wurden aus dem Gedächtnis angegeben und in dieser Umgebung **nicht erneut nachgeschlagen**.

## Grenzen
- Keine Trainingsplan-Erstellung, keine Technikkontrolle, keine Diagnosen.
- Der Katalog umfasst über 80 Übungen (Einzel- und Mehrgelenk); eigene Übungen sind noch nicht möglich.
- Krafteinheiten liegen nur lokal; keine Server-Synchronisierung.

## Muskelfigur und Regionen
- 15 Muskelgruppen für das Wochenvolumen, 28 feine Regionen (z. B. langer/kurzer Bizepskopf, Brachialis, obere/mittlere/untere Brust, Rectus femoris) für die Figur (`src/core/exercises.ts`, `src/core/bodyMap.ts`).
- Die Regionen-Gewichte (1 / 0,5 / 0,25) sind eine **Modellannahme** aus Biomechanik und Praxiswissen, keine Messung an dir. EMG zeigt Aktivierung, nicht automatisch Muskelwachstum; Unterschiede zwischen Winkeln und Griffen sind oft klein. Evidenz: vorläufig.
- Beispiele der Annahmen: Incline Curl (flacher Winkel) betont den langen Bizepskopf in gedehnter Position; Preacher-Curls mit Schulterflexion verkürzen den langen Kopf vorab, Brachialis und kurzer Kopf übernehmen mehr; Hammer-Varianten belasten den Brachialis stärker; Überkopf-Trizepsübungen betonen den langen Kopf (Maeo et al. 2023, bitte nachprüfen).
- „Absteigender Brachialis-Curl“ ist als Drop-Satz mit neutralem Griff umgesetzt (Gewicht nach Beinahe-Versagen um ca. 20–30 % senken). Falls du etwas anderes meintest, sag Bescheid.
- Die Körperfigur ist stilisiert und kein anatomischer Atlas; Formen sind Annäherungen und wurden nur als Zeichnung im Browser geprüft, nicht in der App.
