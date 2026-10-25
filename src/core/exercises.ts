/**
 * ÜBUNGSKATALOG mit Muskel-Regionen
 * ---------------------------------
 * Grobe Muskelgruppen (`Muscle`) dienen dem Wochenvolumen (Forschungsrichtwerte gelten für Gruppen).
 * Feine Regionen (`Region`) dienen NUR der Anzeige auf der Körperfigur: Sie zeigen, welche Teile eines Muskels eine Übung
 * nach gängiger Biomechanik und Praxiswissen besonders belastet. Die Gewichte (1 = Hauptziel, 0,5 = deutlich beteiligt,
 * 0,25 = gering beteiligt) sind eine MODELLANNAHME, keine Messung. Elektromyografie (EMG) zeigt Aktivierung, nicht
 * automatisch Muskelwachstum; Unterschiede zwischen Winkeln und Griffen sind oft klein und von Person zu Person verschieden.
 * Evidenzlage dazu: vorläufig. Plausibel und diskutiert ist, dass Training in gedehnter Muskelposition das Wachstum begünstigt
 * (z. B. Maeo et al. 2023 zum Trizeps über Kopf; bitte selbst nachprüfen).
 */

export type Muscle =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'traps' | 'lower_back'
  | 'quads' | 'hamstrings' | 'glutes' | 'abductors' | 'adductors' | 'calves' | 'abs';

export const MUSCLES: readonly Muscle[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'traps', 'lower_back',
  'quads', 'hamstrings', 'glutes', 'abductors', 'adductors', 'calves', 'abs',
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Brust', back: 'Rücken (Latissimus, Mitte)', shoulders: 'Schultern', biceps: 'Bizeps & Brachialis', triceps: 'Trizeps',
  forearms: 'Unterarme', traps: 'Nacken/Trapez', lower_back: 'Unterer Rücken', quads: 'Oberschenkel vorne', hamstrings: 'Beinbeuger',
  glutes: 'Gesäß', abductors: 'Abduktoren (seitl. Gesäß)', adductors: 'Adduktoren (Innenseite)', calves: 'Waden', abs: 'Bauch & Schräge',
};

export type Region =
  | 'chest_clav' | 'chest_sternal' | 'chest_lower'
  | 'delt_front' | 'delt_side' | 'delt_rear'
  | 'traps_upper' | 'back_mid' | 'back_lats' | 'erectors'
  | 'biceps_long' | 'biceps_short' | 'brachialis' | 'brachioradialis' | 'forearm_flex' | 'forearm_ext'
  | 'tri_long' | 'tri_short'
  | 'quads_rf' | 'quads_vasti' | 'adductors' | 'abductors' | 'glutes' | 'hams'
  | 'calf_gastroc' | 'calf_soleus' | 'abs_rectus' | 'obliques';

export const REGIONS: readonly Region[] = [
  'chest_clav', 'chest_sternal', 'chest_lower', 'delt_front', 'delt_side', 'delt_rear', 'traps_upper', 'back_mid', 'back_lats', 'erectors',
  'biceps_long', 'biceps_short', 'brachialis', 'brachioradialis', 'forearm_flex', 'forearm_ext', 'tri_long', 'tri_short',
  'quads_rf', 'quads_vasti', 'adductors', 'abductors', 'glutes', 'hams', 'calf_gastroc', 'calf_soleus', 'abs_rectus', 'obliques',
];

export const REGION_LABEL: Record<Region, string> = {
  chest_clav: 'Obere Brust', chest_sternal: 'Mittlere Brust', chest_lower: 'Untere Brust',
  delt_front: 'Vordere Schulter', delt_side: 'Seitliche Schulter', delt_rear: 'Hintere Schulter',
  traps_upper: 'Oberer Trapez', back_mid: 'Mittlerer Rücken (Rhomboiden, Trapez)', back_lats: 'Latissimus', erectors: 'Rückenstrecker',
  biceps_long: 'Bizeps langer Kopf (außen)', biceps_short: 'Bizeps kurzer Kopf (innen)', brachialis: 'Brachialis', brachioradialis: 'Brachioradialis',
  forearm_flex: 'Unterarmbeuger', forearm_ext: 'Unterarmstrecker', tri_long: 'Trizeps langer Kopf', tri_short: 'Trizeps lateraler/medialer Kopf',
  quads_rf: 'Rectus femoris', quads_vasti: 'Vastus-Muskeln', adductors: 'Adduktoren', abductors: 'Gesäß seitlich (Medius/Minimus)', glutes: 'Gesäßmuskel (Maximus)',
  hams: 'Beinbeuger', calf_gastroc: 'Wade (Gastrocnemius)', calf_soleus: 'Wade (Soleus)', abs_rectus: 'Gerader Bauchmuskel', obliques: 'Schräge Bauchmuskeln',
};

export const REGION_GROUP: Record<Region, Muscle> = {
  chest_clav: 'chest', chest_sternal: 'chest', chest_lower: 'chest',
  delt_front: 'shoulders', delt_side: 'shoulders', delt_rear: 'shoulders',
  traps_upper: 'traps', back_mid: 'back', back_lats: 'back', erectors: 'lower_back',
  biceps_long: 'biceps', biceps_short: 'biceps', brachialis: 'biceps', brachioradialis: 'forearms', forearm_flex: 'forearms', forearm_ext: 'forearms',
  tri_long: 'triceps', tri_short: 'triceps',
  quads_rf: 'quads', quads_vasti: 'quads', adductors: 'adductors', abductors: 'abductors', glutes: 'glutes', hams: 'hamstrings',
  calf_gastroc: 'calves', calf_soleus: 'calves', abs_rectus: 'abs', obliques: 'abs',
};

export type Evidence = 'solid' | 'moderate' | 'preliminary';
export const EVIDENCE: Record<Evidence, string> = { solid: 'gut belegt', moderate: 'moderat belegt', preliminary: 'vorläufig / Praxiswissen' };

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
export const EQUIPMENT_LABEL: Record<Equipment, string> = { barbell: 'Langhantel', dumbbell: 'Kurzhantel', machine: 'Maschine', cable: 'Kabelzug', bodyweight: 'Körpergewicht' };

export interface Exercise {
  id: string;
  name: string;
  /** single = Einzelgelenk-Übung (Isolation), multi = Mehrgelenk-Übung. */
  joint: 'single' | 'multi';
  primary: Muscle[];
  secondary: Muscle[];
  /** Feine Regionen mit Gewicht 0–1 (nur Anzeige, Modellannahme). */
  regions: Partial<Record<Region, number>>;
  equipment: Equipment;
  /** Übliche kleinste Laststeigerung in kg. */
  increment: number;
  /** Empfohlener Wiederholungsbereich für die doppelte Progression. */
  repRange: [number, number];
  /** Technik-/Sicherheitshinweis (kurz). */
  cue: string;
}

type R = Exercise['regions'];
const x = (
  id: string, name: string, joint: Exercise['joint'], equipment: Equipment, increment: number, repRange: [number, number],
  primary: Muscle[], secondary: Muscle[], regions: R, cue: string,
): Exercise => ({ id, name, joint, equipment, increment, repRange, primary, secondary, regions, cue });

export const EXERCISES: readonly Exercise[] = [
  // ───── Brust ─────
  x('bench_press', 'Bankdrücken (Langhantel)', 'multi', 'barbell', 2.5, [5, 10], ['chest'], ['triceps', 'shoulders'], { chest_sternal: 1, chest_clav: 0.5, chest_lower: 0.5, delt_front: 0.5, tri_short: 0.5, tri_long: 0.25 }, 'Schulterblätter zusammen, Füße fest. Safety-Arme oder Spotter nutzen.'),
  x('incline_bench', 'Schrägbankdrücken (Langhantel)', 'multi', 'barbell', 2.5, [5, 10], ['chest'], ['shoulders', 'triceps'], { chest_clav: 1, chest_sternal: 0.5, delt_front: 0.5, tri_short: 0.5, tri_long: 0.25 }, 'Bank ca. 30° (flacher belastet die obere Brust mit weniger Schulter). Safety-Arme oder Spotter nutzen.'),
  x('decline_press', 'Negativbankdrücken', 'multi', 'barbell', 2.5, [6, 10], ['chest'], ['triceps', 'shoulders'], { chest_lower: 1, chest_sternal: 0.5, tri_short: 0.5, tri_long: 0.25, delt_front: 0.25 }, 'Sicher einhängen, Spotter nutzen.'),
  x('db_bench_press', 'Bankdrücken (Kurzhantel)', 'multi', 'dumbbell', 2, [6, 12], ['chest'], ['triceps', 'shoulders'], { chest_sternal: 1, chest_clav: 0.5, chest_lower: 0.5, delt_front: 0.5, tri_short: 0.5, tri_long: 0.25 }, 'Tiefe Dehnung der Brust, Ellbogen ca. 45–60° zum Körper.'),
  x('incline_db_press', 'Schrägbankdrücken (Kurzhantel)', 'multi', 'dumbbell', 2, [8, 12], ['chest'], ['shoulders', 'triceps'], { chest_clav: 1, chest_sternal: 0.5, delt_front: 0.5, tri_short: 0.5, tri_long: 0.25 }, 'Ellbogen leicht unter den Handgelenken, kontrolliert absenken.'),
  x('chest_press_machine', 'Brustpresse (Maschine)', 'multi', 'machine', 5, [8, 15], ['chest'], ['triceps', 'shoulders'], { chest_sternal: 1, chest_clav: 0.5, chest_lower: 0.5, delt_front: 0.5, tri_short: 0.5 }, 'Sitz so stellen, dass die Griffe auf Brusthöhe liegen.'),
  x('pushup', 'Liegestütz (mit Zusatzgewicht)', 'multi', 'bodyweight', 2.5, [8, 20], ['chest'], ['triceps', 'shoulders', 'abs'], { chest_sternal: 1, chest_lower: 0.5, delt_front: 0.5, tri_short: 0.5, abs_rectus: 0.25 }, 'Körper in einer Linie, Brust bis knapp über den Boden.'),
  x('dips_chest', 'Dips (Brust, vorgebeugt)', 'multi', 'bodyweight', 2.5, [6, 12], ['chest'], ['triceps', 'shoulders'], { chest_lower: 1, chest_sternal: 0.5, tri_short: 0.5, tri_long: 0.5, delt_front: 0.5 }, 'Oberkörper nach vorn, nur so tief, wie die Schulter schmerzfrei mitmacht.'),
  x('cable_fly', 'Kabelzug-Fliegende', 'single', 'cable', 2.5, [10, 15], ['chest'], [], { chest_sternal: 1, chest_clav: 0.5, chest_lower: 0.5 }, 'Leichte Ellbogenbeugung beibehalten, Dehnung unten.'),
  x('low_to_high_fly', 'Kabelzug von unten nach oben (obere Brust)', 'single', 'cable', 2.5, [10, 15], ['chest'], ['shoulders'], { chest_clav: 1, chest_sternal: 0.5, delt_front: 0.25 }, 'Arme führen schräg nach oben zusammen, Schultern unten.'),
  x('high_to_low_fly', 'Kabelzug von oben nach unten (untere Brust)', 'single', 'cable', 2.5, [10, 15], ['chest'], [], { chest_lower: 1, chest_sternal: 0.5 }, 'Arme führen schräg nach unten zusammen.'),
  x('pec_deck', 'Butterfly (Brustmaschine)', 'single', 'machine', 2.5, [10, 15], ['chest'], [], { chest_sternal: 1, chest_clav: 0.5, chest_lower: 0.25 }, 'Nicht zu weit nach hinten dehnen, Schultern stabil.'),
  x('db_fly', 'Fliegende (Kurzhantel)', 'single', 'dumbbell', 1, [10, 15], ['chest'], [], { chest_sternal: 1, chest_clav: 0.5, chest_lower: 0.25 }, 'Nur bis zu einer angenehmen Dehnung absenken (Schulter schützen).'),

  // ───── Rücken ─────
  x('pullup', 'Klimmzug (Obergriff)', 'multi', 'bodyweight', 1.25, [5, 10], ['back'], ['biceps', 'forearms'], { back_lats: 1, back_mid: 0.5, biceps_short: 0.5, biceps_long: 0.25, brachialis: 0.5, brachioradialis: 0.25, forearm_flex: 0.25 }, 'Schulterblätter aktiv, volle Streckung unten.'),
  x('chinup', 'Klimmzug (Untergriff)', 'multi', 'bodyweight', 1.25, [5, 10], ['back', 'biceps'], ['forearms'], { back_lats: 1, back_mid: 0.5, biceps_short: 1, biceps_long: 0.5, brachialis: 0.5, brachioradialis: 0.25 }, 'Untergriff schulterbreit, nicht aus dem Schwung.'),
  x('lat_pulldown', 'Latzug', 'multi', 'cable', 2.5, [8, 12], ['back'], ['biceps'], { back_lats: 1, back_mid: 0.5, biceps_short: 0.5, brachialis: 0.5 }, 'Zur oberen Brust ziehen, nicht hinter den Kopf.'),
  x('neutral_pulldown', 'Latzug (neutraler Griff)', 'multi', 'cable', 2.5, [8, 12], ['back'], ['biceps', 'forearms'], { back_lats: 1, back_mid: 0.5, biceps_short: 0.5, brachialis: 0.5, brachioradialis: 0.25 }, 'Ellbogen nach unten und leicht nach hinten führen.'),
  x('row', 'Rudern am Kabel (sitzend)', 'multi', 'cable', 2.5, [8, 12], ['back'], ['biceps', 'shoulders'], { back_mid: 1, back_lats: 0.5, delt_rear: 0.5, biceps_short: 0.5, brachialis: 0.25 }, 'Brust raus, Zug aus dem Rücken statt aus dem Schwung.'),
  x('barbell_row', 'Langhantelrudern (vorgebeugt)', 'multi', 'barbell', 2.5, [6, 10], ['back'], ['biceps', 'lower_back', 'shoulders', 'traps'], { back_mid: 1, back_lats: 0.5, delt_rear: 0.5, traps_upper: 0.5, erectors: 0.5, biceps_short: 0.5, brachialis: 0.25 }, 'Rücken neutral, Hüfte zurück; bei Rückenproblemen eine gestützte Variante wählen.'),
  x('db_row', 'Einarm-Kurzhantelrudern', 'multi', 'dumbbell', 2, [8, 12], ['back'], ['biceps', 'shoulders'], { back_lats: 1, back_mid: 0.5, delt_rear: 0.25, biceps_short: 0.5, brachialis: 0.25 }, 'Rumpf stabil, Ellbogen zur Hüfte ziehen.'),
  x('chest_supported_row', 'Rudern brustgestützt', 'multi', 'machine', 2.5, [8, 12], ['back'], ['biceps', 'shoulders'], { back_mid: 1, back_lats: 0.5, delt_rear: 0.5, biceps_short: 0.25, brachialis: 0.25 }, 'Brust am Polster, nicht mit dem Körper mitschwingen.'),
  x('tbar_row', 'T-Bar-Rudern', 'multi', 'barbell', 2.5, [6, 12], ['back'], ['biceps', 'lower_back', 'traps'], { back_mid: 1, back_lats: 0.5, traps_upper: 0.5, erectors: 0.25, biceps_short: 0.5, brachialis: 0.25 }, 'Rücken neutral, Zug zur Brust.'),
  x('straight_arm_pulldown', 'Straight-Arm-Pulldown', 'single', 'cable', 2.5, [10, 15], ['back'], [], { back_lats: 1 }, 'Arme fast gestreckt, Zug aus der Schulter.'),
  x('face_pull', 'Face Pull', 'single', 'cable', 2.5, [12, 20], ['shoulders'], ['back', 'traps'], { delt_rear: 1, back_mid: 0.5, traps_upper: 0.25 }, 'Seil zum Gesicht, Hände auseinander, Außenrotation am Ende.'),
  x('shrug', 'Shrugs (Schulterheben)', 'single', 'dumbbell', 2, [8, 15], ['traps'], ['forearms'], { traps_upper: 1, forearm_flex: 0.25 }, 'Gerade nach oben ziehen, nicht kreisen.'),
  x('deadlift', 'Kreuzheben', 'multi', 'barbell', 2.5, [3, 8], ['hamstrings', 'glutes', 'lower_back'], ['back', 'traps', 'quads', 'forearms'], { hams: 1, glutes: 1, erectors: 1, back_lats: 0.5, traps_upper: 0.5, back_mid: 0.5, quads_vasti: 0.5, forearm_flex: 0.5 }, 'Rücken neutral, Stange nah am Körper, Ermüdung hoch – Technik vor Gewicht.'),
  x('rack_pull', 'Rack Pull', 'multi', 'barbell', 5, [4, 8], ['lower_back', 'back', 'traps'], ['glutes', 'hamstrings', 'forearms'], { erectors: 1, back_mid: 0.5, traps_upper: 1, glutes: 0.5, hams: 0.5, forearm_flex: 0.5 }, 'Höhe knapp unter dem Knie, Rücken neutral.'),
  x('back_extension', 'Rückenstrecker (45°-Bank)', 'single', 'bodyweight', 2.5, [10, 15], ['lower_back'], ['glutes', 'hamstrings'], { erectors: 1, glutes: 0.5, hams: 0.5 }, 'Kontrolliert bis zur Hüftlinie, kein Überstrecken.'),

  // ───── Schultern ─────
  x('ohp', 'Schulterdrücken (Langhantel)', 'multi', 'barbell', 2.5, [6, 10], ['shoulders'], ['triceps'], { delt_front: 1, delt_side: 0.5, tri_short: 0.5, tri_long: 0.25 }, 'Rippen unten, Gesäß anspannen, Stange über den Mittelfuß.'),
  x('db_shoulder_press', 'Schulterdrücken (Kurzhantel)', 'multi', 'dumbbell', 2, [6, 12], ['shoulders'], ['triceps'], { delt_front: 1, delt_side: 0.5, tri_short: 0.5, tri_long: 0.25 }, 'Gestützter Rücken hilft, Hanteln leicht nach vorn führen.'),
  x('machine_shoulder_press', 'Schulterpresse (Maschine)', 'multi', 'machine', 5, [8, 15], ['shoulders'], ['triceps'], { delt_front: 1, delt_side: 0.5, tri_short: 0.5 }, 'Sitz so einstellen, dass die Griffe auf Schulterhöhe starten.'),
  x('arnold_press', 'Arnold Press', 'multi', 'dumbbell', 2, [8, 12], ['shoulders'], ['triceps'], { delt_front: 1, delt_side: 0.5, tri_short: 0.25 }, 'Drehung kontrolliert, nicht schleudern.'),
  x('lateral_raise', 'Seitheben (Kurzhantel)', 'single', 'dumbbell', 1, [10, 20], ['shoulders'], ['traps'], { delt_side: 1, traps_upper: 0.25 }, 'Mit Schwung sparsam, Ellbogen führen.'),
  x('cable_lateral_raise', 'Seitheben am Kabel (Einarm)', 'single', 'cable', 1, [10, 20], ['shoulders'], [], { delt_side: 1 }, 'Kabel kommt von der Gegenseite → Spannung auch in der Startposition (gedehnter).'),
  x('machine_lateral_raise', 'Seitheben (Maschine)', 'single', 'machine', 2.5, [10, 20], ['shoulders'], [], { delt_side: 1 }, 'Ellbogen leicht unter Schulterhöhe führen.'),
  x('front_raise', 'Frontheben', 'single', 'dumbbell', 1, [10, 15], ['shoulders'], [], { delt_front: 1 }, 'Bis etwa Schulterhöhe, kein Schwung.'),
  x('rear_delt_fly', 'Reverse Fly (Kurzhantel, vorgebeugt)', 'single', 'dumbbell', 1, [12, 20], ['shoulders'], ['back'], { delt_rear: 1, back_mid: 0.5 }, 'Rücken neutral, Ellbogen nach außen führen.'),
  x('reverse_pec_deck', 'Reverse Butterfly (Maschine)', 'single', 'machine', 2.5, [12, 20], ['shoulders'], ['back'], { delt_rear: 1, back_mid: 0.5 }, 'Arme auf Schulterhöhe, nicht mit dem Rücken ziehen.'),
  x('upright_row', 'Aufrechtes Rudern (Kabel/SZ-Stange)', 'multi', 'cable', 2.5, [8, 12], ['shoulders', 'traps'], ['biceps'], { delt_side: 1, traps_upper: 1, biceps_short: 0.25 }, 'Nur bis Brusthöhe ziehen; bei Schulterproblemen eher meiden.'),

  // ───── Bizeps / Brachialis / Unterarm ─────
  x('biceps_curl', 'Bizepscurl (Kurzhantel, stehend)', 'single', 'dumbbell', 1, [8, 15], ['biceps'], ['forearms'], { biceps_short: 1, biceps_long: 0.75, brachialis: 0.5, brachioradialis: 0.25 }, 'Ellbogen vorne fixieren, unten voll strecken.'),
  x('barbell_curl', 'Langhantelcurl', 'single', 'barbell', 2.5, [6, 12], ['biceps'], ['forearms'], { biceps_short: 1, biceps_long: 0.75, brachialis: 0.5, brachioradialis: 0.25 }, 'Nicht mit dem Rücken schwingen.'),
  x('ez_curl', 'SZ-Stangen-Curl', 'single', 'barbell', 2.5, [8, 12], ['biceps'], ['forearms'], { biceps_short: 1, biceps_long: 0.75, brachialis: 0.5, brachioradialis: 0.5 }, 'Schonender für die Handgelenke als eine gerade Stange.'),
  x('incline_curl_60', 'Incline Curl 60° (Schrägbank, Kurzhantel)', 'single', 'dumbbell', 1, [8, 15], ['biceps'], [], { biceps_long: 1, biceps_short: 0.75, brachialis: 0.5 }, 'Bank ca. 60° gegen die Waagerechte: Arme hängen leicht hinter dem Körper → langer Kopf wird gedehnt. Untere Position voll nutzen.'),
  x('incline_curl_30', 'Incline Curl 30° (stark zurückgelehnt)', 'single', 'dumbbell', 1, [8, 15], ['biceps'], [], { biceps_long: 1, biceps_short: 0.5, brachialis: 0.5 }, 'Bank ca. 30° gegen die Waagerechte: stärker gedehnte Position des langen Kopfes, leichtere Gewichte nötig. Winkelangaben werden in der Praxis uneinheitlich genannt.'),
  x('bayesian_curl', 'Bayesian Curl (Kabel, Arm hinter dem Körper)', 'single', 'cable', 1, [8, 15], ['biceps'], [], { biceps_long: 1, biceps_short: 0.75, brachialis: 0.5 }, 'Rücken zum Turm, Arm nach hinten: hohe Spannung in der gedehnten Position.'),
  x('preacher_curl', 'Preacher Curl (Schulter flektiert)', 'single', 'machine', 2.5, [8, 15], ['biceps'], ['forearms'], { biceps_short: 1, brachialis: 0.75, biceps_long: 0.5, brachioradialis: 0.25 }, 'Die Schulterflexion verkürzt den langen Kopf vorab; Brachialis und kurzer Kopf übernehmen mehr. Unten nicht ins Gelenk fallen lassen.'),
  x('preacher_hammer', 'Preacher Hammer Curl (neutraler Griff)', 'single', 'dumbbell', 1, [8, 15], ['biceps'], ['forearms'], { brachialis: 1, brachioradialis: 0.75, biceps_short: 0.5, biceps_long: 0.25 }, 'Neutraler Griff plus gebeugte Schulter → brachialislastig.'),
  x('spider_curl', 'Spider Curl (Brust auf Schrägbank)', 'single', 'dumbbell', 1, [8, 15], ['biceps'], [], { biceps_short: 1, brachialis: 0.75, biceps_long: 0.5 }, 'Arme hängen nach vorn (Schulterflexion), volle Kontraktion oben.'),
  x('hammer_curl', 'Hammer Curl', 'single', 'dumbbell', 1, [8, 15], ['biceps'], ['forearms'], { brachialis: 1, brachioradialis: 0.75, biceps_long: 0.5, biceps_short: 0.5 }, 'Neutraler Griff (Daumen oben), Ellbogen am Körper.'),
  x('cross_body_hammer', 'Cross-Body Hammer Curl', 'single', 'dumbbell', 1, [8, 15], ['biceps'], ['forearms'], { brachialis: 1, brachioradialis: 0.75, biceps_long: 0.5 }, 'Hantel diagonal zur Gegenschulter führen.'),
  x('descending_brachialis_curl', 'Absteigender Brachialis-Curl (Drop-Satz, neutraler Griff)', 'single', 'dumbbell', 1, [8, 15], ['biceps'], ['forearms'], { brachialis: 1, brachioradialis: 0.75, biceps_long: 0.5, biceps_short: 0.5 }, 'Absteigender Satz: bis nahe ans Versagen, Gewicht sofort um ca. 20–30 % senken und weiter. Zählt als EIN Satz mit mehreren Gewichten – trage das schwerste Gewicht ein.'),
  x('reverse_curl', 'Reverse Curl (Obergriff)', 'single', 'barbell', 2.5, [8, 15], ['biceps', 'forearms'], [], { brachioradialis: 1, brachialis: 1, forearm_ext: 0.75, biceps_short: 0.25 }, 'Handgelenke neutral halten, leichte Last.'),
  x('drag_curl', 'Drag Curl', 'single', 'barbell', 2.5, [8, 12], ['biceps'], [], { biceps_long: 1, biceps_short: 0.5, brachialis: 0.25 }, 'Stange eng am Körper nach oben ziehen, Ellbogen nach hinten.'),
  x('concentration_curl', 'Konzentrationscurl', 'single', 'dumbbell', 1, [10, 15], ['biceps'], [], { biceps_short: 1, brachialis: 0.5, biceps_long: 0.5 }, 'Ellbogen am Oberschenkel abstützen.'),
  x('cable_curl', 'Kabelcurl', 'single', 'cable', 2.5, [10, 15], ['biceps'], ['forearms'], { biceps_short: 1, biceps_long: 0.75, brachialis: 0.5, brachioradialis: 0.25 }, 'Konstante Spannung über den gesamten Weg.'),
  x('wrist_curl', 'Handgelenkcurl (Unterarmbeuger)', 'single', 'dumbbell', 1, [10, 20], ['forearms'], [], { forearm_flex: 1 }, 'Unterarm aufliegen, nur das Handgelenk bewegen.'),
  x('reverse_wrist_curl', 'Reverse Handgelenkcurl (Unterarmstrecker)', 'single', 'dumbbell', 1, [10, 20], ['forearms'], [], { forearm_ext: 1, brachioradialis: 0.25 }, 'Leicht beginnen, Ellbogen stabil.'),

  // ───── Trizeps ─────
  x('triceps_pushdown', 'Trizeps-Pushdown', 'single', 'cable', 2.5, [8, 15], ['triceps'], [], { tri_short: 1, tri_long: 0.5 }, 'Oberarme am Körper, oben vollständig strecken.'),
  x('rope_pushdown', 'Pushdown mit Seil', 'single', 'cable', 2.5, [10, 15], ['triceps'], [], { tri_short: 1, tri_long: 0.5 }, 'Seil unten auseinanderziehen, Ellbogen fixiert.'),
  x('overhead_cable_extension', 'Überkopf-Trizepsstrecken (Kabel)', 'single', 'cable', 2.5, [8, 15], ['triceps'], [], { tri_long: 1, tri_short: 0.5 }, 'Arme über dem Kopf → langer Kopf wird gedehnt (Maeo et al. 2023: mehr Wachstum als neutral, vorläufig).'),
  x('overhead_db_extension', 'Überkopf-Trizepsstrecken (Kurzhantel)', 'single', 'dumbbell', 1, [8, 15], ['triceps'], [], { tri_long: 1, tri_short: 0.5 }, 'Ellbogen zeigen nach vorn, tiefe Dehnung, Hantel mit beiden Händen sichern.'),
  x('skullcrusher', 'Skull Crusher (SZ-Stange)', 'single', 'barbell', 2.5, [8, 12], ['triceps'], [], { tri_long: 1, tri_short: 0.75 }, 'Hinter den Kopf absenken (nicht zur Stirn) für mehr Dehnung; Ellbogen schonend halten.'),
  x('triceps_kickback', 'Trizeps-Kickback', 'single', 'dumbbell', 1, [10, 20], ['triceps'], [], { tri_short: 1, tri_long: 0.5 }, 'Oberarm parallel zum Boden, Hantel leicht.'),
  x('close_grip_bench', 'Enges Bankdrücken', 'multi', 'barbell', 2.5, [6, 10], ['triceps'], ['chest', 'shoulders'], { tri_short: 1, tri_long: 0.75, chest_sternal: 0.5, delt_front: 0.5 }, 'Griff etwa schulterbreit, nicht extrem eng (Handgelenke).'),
  x('dip_triceps', 'Dips (Trizeps, aufrecht)', 'multi', 'bodyweight', 2.5, [6, 12], ['triceps'], ['chest', 'shoulders'], { tri_short: 1, tri_long: 0.75, chest_lower: 0.5, delt_front: 0.5 }, 'Oberkörper aufrecht, Schulter nicht überdehnen.'),

  // ───── Oberschenkel vorne ─────
  x('back_squat', 'Kniebeuge (Langhantel)', 'multi', 'barbell', 2.5, [5, 10], ['quads', 'glutes'], ['hamstrings', 'abs', 'adductors', 'lower_back'], { quads_vasti: 1, quads_rf: 0.5, glutes: 1, adductors: 0.5, hams: 0.25, erectors: 0.5, abs_rectus: 0.25 }, 'Ganze Fußsohle belasten, Rumpf fest, Tiefe nach eigener Beweglichkeit. Safety-Arme oder Spotter nutzen.'),
  x('front_squat', 'Frontkniebeuge', 'multi', 'barbell', 2.5, [5, 10], ['quads'], ['glutes', 'abs', 'lower_back'], { quads_vasti: 1, quads_rf: 0.75, glutes: 0.5, erectors: 0.5, abs_rectus: 0.5 }, 'Ellbogen hoch, aufrechter Oberkörper.'),
  x('hack_squat', 'Hackenschmidt-Kniebeuge (Maschine)', 'multi', 'machine', 5, [6, 12], ['quads'], ['glutes'], { quads_vasti: 1, quads_rf: 0.5, glutes: 0.5 }, 'Fersen fest, Knie in Zehenrichtung.'),
  x('pendulum_squat', 'Pendulum Squat (Maschine)', 'multi', 'machine', 5, [6, 12], ['quads'], ['glutes'], { quads_vasti: 1, quads_rf: 0.5, glutes: 0.5 }, 'Tiefe Beugung bei sicherer Führung.'),
  x('leg_press', 'Beinpresse', 'multi', 'machine', 5, [8, 15], ['quads', 'glutes'], ['adductors'], { quads_vasti: 1, quads_rf: 0.5, glutes: 0.75, adductors: 0.5 }, 'Unteren Rücken am Polster lassen, Knie in Zehenrichtung.'),
  x('leg_extension', 'Beinstrecker', 'single', 'machine', 2.5, [10, 20], ['quads'], [], { quads_rf: 1, quads_vasti: 1 }, 'Rückenlehne zurück (Hüfte gestreckter → mehr Rectus femoris gedehnt wird), kontrolliert ablassen.'),
  x('bulgarian_split_squat', 'Bulgarische Kniebeuge', 'multi', 'dumbbell', 2, [6, 12], ['quads', 'glutes'], ['adductors', 'abductors'], { quads_vasti: 1, quads_rf: 0.5, glutes: 1, adductors: 0.5, abductors: 0.5 }, 'Hinteren Fuß erhöht, vorderes Knie über dem Mittelfuß.'),
  x('walking_lunge', 'Ausfallschritte (gehend)', 'multi', 'dumbbell', 2, [8, 15], ['quads', 'glutes'], ['adductors', 'abductors'], { quads_vasti: 1, quads_rf: 0.5, glutes: 1, adductors: 0.5, abductors: 0.5 }, 'Aufrecht, ausreichend langer Schritt.'),
  x('step_up', 'Step-up', 'multi', 'dumbbell', 2, [8, 15], ['quads', 'glutes'], ['abductors'], { quads_vasti: 1, glutes: 0.75, abductors: 0.5 }, 'Mit dem oberen Bein drücken, nicht vom unteren abstoßen.'),
  x('sissy_squat', 'Sissy Squat', 'single', 'bodyweight', 2.5, [8, 15], ['quads'], [], { quads_rf: 1, quads_vasti: 0.75 }, 'Fortgeschritten; Knie belastend – langsam steigern.'),

  // ───── Beinbeuger / Gesäß / Abduktoren / Adduktoren ─────
  x('rdl', 'Rumänisches Kreuzheben', 'multi', 'barbell', 2.5, [6, 12], ['hamstrings', 'glutes'], ['lower_back', 'forearms'], { hams: 1, glutes: 1, erectors: 0.5, forearm_flex: 0.25 }, 'Hüfte nach hinten schieben, Rücken neutral, Stange nah am Körper.'),
  x('good_morning', 'Good Morning', 'multi', 'barbell', 2.5, [8, 12], ['hamstrings', 'lower_back'], ['glutes'], { hams: 1, erectors: 1, glutes: 0.5 }, 'Leicht beginnen, Rücken neutral.'),
  x('lying_leg_curl', 'Beinbeuger liegend', 'single', 'machine', 2.5, [8, 15], ['hamstrings'], ['calves'], { hams: 1, calf_gastroc: 0.25 }, 'Hüfte am Polster, volle Bewegungsweite.'),
  x('seated_leg_curl', 'Beinbeuger sitzend', 'single', 'machine', 2.5, [8, 15], ['hamstrings'], ['calves'], { hams: 1, calf_gastroc: 0.25 }, 'Sitzend ist der Beinbeuger an der Hüfte gedehnt (gute Dehnposition).'),
  x('nordic_curl', 'Nordic Curl', 'single', 'bodyweight', 2.5, [3, 8], ['hamstrings'], [], { hams: 1 }, 'Sehr fordernd, langsam absenken; mit Gummiband erleichtern.'),
  x('hip_thrust', 'Hip Thrust', 'multi', 'barbell', 5, [6, 12], ['glutes'], ['hamstrings', 'abductors'], { glutes: 1, hams: 0.5, abductors: 0.25 }, 'Kinn leicht angezogen, oben Gesäß anspannen ohne Hohlkreuz.'),
  x('glute_bridge', 'Glute Bridge', 'multi', 'barbell', 5, [8, 15], ['glutes'], ['hamstrings'], { glutes: 1, hams: 0.5 }, 'Rippen unten, Hüfte vollständig strecken.'),
  x('cable_pull_through', 'Pull-through (Kabel)', 'multi', 'cable', 2.5, [10, 15], ['glutes', 'hamstrings'], ['lower_back'], { glutes: 1, hams: 1, erectors: 0.25 }, 'Hüftbeuge, Rücken neutral, Spannung im Gesäß.'),
  x('cable_kickback', 'Gesäß-Kickback (Kabel)', 'single', 'cable', 1.25, [10, 20], ['glutes'], ['hamstrings'], { glutes: 1, hams: 0.25 }, 'Nicht ins Hohlkreuz ausweichen.'),
  x('hip_abduction', 'Abduktorenmaschine', 'single', 'machine', 2.5, [12, 20], ['abductors'], ['glutes'], { abductors: 1, glutes: 0.5 }, 'Kontrolliert öffnen und schließen.'),
  x('hip_adduction', 'Adduktorenmaschine', 'single', 'machine', 2.5, [10, 20], ['adductors'], [], { adductors: 1 }, 'Gelenkig dehnen, nicht reißen.'),

  // ───── Waden ─────
  x('calf_raise', 'Wadenheben stehend', 'single', 'machine', 2.5, [8, 15], ['calves'], [], { calf_gastroc: 1, calf_soleus: 0.5 }, 'Unten dehnen, oben kurz halten.'),
  x('seated_calf_raise', 'Wadenheben sitzend', 'single', 'machine', 2.5, [10, 20], ['calves'], [], { calf_soleus: 1, calf_gastroc: 0.25 }, 'Bei gebeugtem Knie arbeitet der Soleus stärker.'),
  x('leg_press_calf_raise', 'Wadenheben an der Beinpresse', 'single', 'machine', 5, [10, 20], ['calves'], [], { calf_gastroc: 1, calf_soleus: 0.5 }, 'Knie fast gestreckt, Fußballen auf der Platte.'),

  // ───── Bauch ─────
  x('cable_crunch', 'Kabel-Crunch', 'single', 'cable', 2.5, [10, 15], ['abs'], [], { abs_rectus: 1, obliques: 0.25 }, 'Wirbelsäule einrollen statt aus der Hüfte ziehen.'),
  x('machine_crunch', 'Bauchmaschine', 'single', 'machine', 2.5, [10, 20], ['abs'], [], { abs_rectus: 1, obliques: 0.25 }, 'Rumpf einrollen, Hüftbeuger nicht übernehmen lassen.'),
  x('hanging_leg_raise', 'Hängendes Beinheben', 'multi', 'bodyweight', 1.25, [8, 15], ['abs'], ['forearms'], { abs_rectus: 1, obliques: 0.5, forearm_flex: 0.25 }, 'Becken aufrollen, nicht schwingen.'),
  x('ab_wheel', 'Ab-Roller', 'multi', 'bodyweight', 2.5, [6, 15], ['abs'], ['shoulders', 'back'], { abs_rectus: 1, obliques: 0.5, delt_front: 0.25, back_lats: 0.25 }, 'Rücken rund halten, nur so weit rollen, wie der Rumpf stabil bleibt.'),
  x('cable_woodchop', 'Kabel-Woodchop', 'single', 'cable', 2.5, [10, 15], ['abs'], [], { obliques: 1, abs_rectus: 0.5 }, 'Aus dem Rumpf drehen, Arme sind nur Hebel.'),
  x('side_bend', 'Seitbeugen (Kurzhantel)', 'single', 'dumbbell', 2, [10, 20], ['abs'], [], { obliques: 1 }, 'Kontrolliert zur Seite, nicht nach vorn kippen.'),
];

export const exerciseById = (id: string): Exercise | undefined => EXERCISES.find((e) => e.id === id);

/** Regionen-Last aus (gewichteten) harten Sätzen; Schlüssel nur für Regionen mit Last > 0. */
export function regionLoad(entries: Array<{ exerciseId: string; hardSets: number }>): Partial<Record<Region, number>> {
  const out: Partial<Record<Region, number>> = {};
  for (const e of entries) {
    const ex = exerciseById(e.exerciseId);
    if (!ex || !(e.hardSets > 0)) continue;
    for (const r of REGIONS) {
      const w = ex.regions[r];
      if (w) out[r] = Math.round(((out[r] ?? 0) + w * e.hardSets) * 100) / 100;
    }
  }
  return out;
}
