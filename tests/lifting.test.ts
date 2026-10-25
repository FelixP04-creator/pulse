import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACTIVITY_KINDS, estimateKcal, intensityFromRpe, kindFromLabel } from '../src/core/activities.ts';
import {
  EXERCISES, MUSCLES, REGIONS, REGION_GROUP, regionLoad, weeklyRegionLoad, bestE1rm, deloadHint, e1rmDeclines, e1rm, exerciseById, isHardSet, liftSessionToWorkout, personalRecords, progressionAdvice,
  sessionRpe, sessionTonnage, validateSet, volumeStatus, weeklyVolume, type LiftSession,
} from '../src/core/lifting.ts';
import { workoutLoad } from '../src/core/strain.ts';

const sess = (date: string, entries: LiftSession['entries'], extra: Partial<LiftSession> = {}): LiftSession => ({ id: date, date, entries, ...extra });
const sets = (n: number, reps: number, w: number, rir = 2) => Array.from({ length: n }, () => ({ reps, weightKg: w, rir }));

describe('Übungskatalog', () => {
  it('IDs eindeutig, Bereiche und Muskeln plausibel', () => {
    assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
    for (const e of EXERCISES) {
      assert.ok(e.primary.length >= 1, e.id);
      assert.ok(e.repRange[0] < e.repRange[1] && e.repRange[0] >= 3 && e.repRange[1] <= 30, e.id);
      assert.ok(e.increment > 0, e.id);
      assert.ok(!e.primary.some((m) => e.secondary.includes(m)), `${e.id}: Muskel doppelt`);
    }
  });
});

describe('Katalog-Konsistenz (Regionen)', () => {
  it('mindestens 80 Übungen, Einzel- und Mehrgelenk, alle Muskeln abgedeckt', () => {
    assert.ok(EXERCISES.length >= 80, String(EXERCISES.length));
    assert.ok(EXERCISES.filter((e) => e.joint === 'single').length >= 30);
    assert.ok(EXERCISES.filter((e) => e.joint === 'multi').length >= 25);
    for (const m of MUSCLES) assert.ok(EXERCISES.some((e) => e.primary.includes(m)), `kein Primärmuskel ${m}`);
    for (const r of REGIONS) assert.ok(EXERCISES.some((e) => (e.regions[r] ?? 0) >= 1), `keine Übung mit Hauptziel ${r}`);
  });
  it('Regionen passen zu den Muskelgruppen der Übung, Gewichte 0–1, Primärmuskel hat ein Hauptziel', () => {
    for (const e of EXERCISES) {
      const groups = new Set([...e.primary, ...e.secondary]);
      for (const [r, w] of Object.entries(e.regions)) {
        assert.ok(REGIONS.includes(r as never), `${e.id}: Region ${r}`);
        assert.ok((w as number) > 0 && (w as number) <= 1, `${e.id}.${r}`);
        assert.ok(groups.has(REGION_GROUP[r as keyof typeof REGION_GROUP]), `${e.id}: Region ${r} gehört zu keiner angegebenen Muskelgruppe`);
      }
      for (const m of e.primary) assert.ok(Object.entries(e.regions).some(([r, w]) => REGION_GROUP[r as keyof typeof REGION_GROUP] === m && (w as number) >= 0.5), `${e.id}: Primärmuskel ${m} ohne Region ≥ 0,5`);
    }
  });
  it('modernen SBL-Übungen sind vorhanden', () => {
    for (const id of ['incline_curl_60', 'incline_curl_30', 'preacher_curl', 'descending_brachialis_curl', 'bayesian_curl', 'overhead_cable_extension', 'spider_curl']) assert.ok(exerciseById(id), id);
  });
  it('Modellannahmen: Preacher entlastet den langen Kopf, Incline betont ihn; Hammer ist brachialislastig', () => {
    const p = exerciseById('preacher_curl')!.regions, i = exerciseById('incline_curl_30')!.regions, h = exerciseById('hammer_curl')!.regions;
    assert.ok((p.biceps_long ?? 0) < (p.biceps_short ?? 0));
    assert.ok((i.biceps_long ?? 0) > (i.biceps_short ?? 0));
    assert.ok((h.brachialis ?? 0) >= (h.biceps_short ?? 0));
  });
  it('Regionen-Last summiert gewichtete harte Sätze und ignoriert unbekannte Übungen', () => {
    const l = regionLoad([{ exerciseId: 'hammer_curl', hardSets: 4 }, { exerciseId: 'preacher_hammer', hardSets: 2 }, { exerciseId: 'nope', hardSets: 9 }, { exerciseId: 'hammer_curl', hardSets: 0 }]);
    assert.equal(l.brachialis, 6);
    assert.equal(l.brachioradialis, 4 * 0.75 + 2 * 0.75);
    assert.equal(l.chest_sternal, undefined);
  });
});

describe('e1RM und Satzprüfung', () => {
  it('Epley und RIR', () => {
    assert.equal(e1rm({ reps: 5, weightKg: 100 }), 116.7);
    assert.equal(e1rm({ reps: 5, weightKg: 100, rir: 2 }), 123.3);
    assert.equal(e1rm({ reps: 1, weightKg: 100 }), 103.3);
  });
  it('liefert keine Schätzung bei Aufwärmsatz, > 12 Wdh., Gewicht 0 oder ungültigen Werten', () => {
    assert.equal(e1rm({ reps: 5, weightKg: 100, warmup: true }), undefined);
    assert.equal(e1rm({ reps: 15, weightKg: 40 }), undefined);
    assert.equal(e1rm({ reps: 5, weightKg: 0 }), undefined);
    assert.equal(e1rm({ reps: NaN, weightKg: 50 }), undefined);
    assert.equal(e1rm({ reps: 0, weightKg: 50 }), undefined);
  });
  it('bestE1rm nimmt den höchsten Wert', () => {
    assert.equal(bestE1rm([{ reps: 8, weightKg: 80 }, { reps: 5, weightKg: 90 }]), 105);
    assert.equal(bestE1rm([]), undefined);
  });
  it('validateSet meldet Fehler verständlich', () => {
    assert.ok(validateSet({ reps: 0, weightKg: 50 }));
    assert.ok(validateSet({ reps: 5, weightKg: -1 }));
    assert.ok(validateSet({ reps: 5, weightKg: 50, rir: 11 }));
    assert.equal(validateSet({ reps: 5, weightKg: 50, rir: 2 }), undefined);
  });
  it('harte Sätze', () => {
    assert.equal(isHardSet({ reps: 8, weightKg: 50, rir: 4 }), true);
    assert.equal(isHardSet({ reps: 8, weightKg: 50, rir: 5 }), false);
    assert.equal(isHardSet({ reps: 8, weightKg: 50, warmup: true }), false);
    assert.equal(isHardSet({ reps: 8, weightKg: 50 }), true);
  });
});

describe('Wochenvolumen', () => {
  const today = '2026-10-25';
  const week = [
    sess('2026-10-20', [{ exerciseId: 'bench_press', sets: sets(4, 8, 80) }, { exerciseId: 'ohp', sets: sets(3, 8, 40) }]),
    sess('2026-10-23', [{ exerciseId: 'bench_press', sets: [...sets(3, 8, 80), { reps: 10, weightKg: 40, warmup: true }] }]),
    sess('2026-10-10', [{ exerciseId: 'bench_press', sets: sets(10, 8, 80) }]), // außerhalb des Fensters
  ];
  it('zählt direkte und indirekte Sätze getrennt, ignoriert Aufwärmsätze und alte Einheiten', () => {
    const v = weeklyVolume(week, today);
    const chest = v.find((x) => x.muscle === 'chest')!;
    assert.equal(chest.direct, 7);
    assert.equal(chest.sessions, 2);
    const tri = v.find((x) => x.muscle === 'triceps')!;
    assert.equal(tri.direct, 0);
    assert.equal(tri.indirect, 4 + 3 + 3);
    assert.equal(tri.effective, 5);
    const sh = v.find((x) => x.muscle === 'shoulders')!;
    assert.equal(sh.direct, 3);
    assert.equal(sh.indirect, 7);
    assert.equal(sh.effective, 6.5);
  });
  it('Fenster ist inklusiv 7 Tage', () => {
    const v = weeklyVolume([sess('2026-10-19', [{ exerciseId: 'bench_press', sets: sets(3, 8, 80) }])], today);
    assert.equal(v.find((x) => x.muscle === 'chest')!.direct, 3);
    const v2 = weeklyVolume([sess('2026-10-18', [{ exerciseId: 'bench_press', sets: sets(3, 8, 80) }])], today);
    assert.equal(v2.find((x) => x.muscle === 'chest')!.direct, 0);
  });
  it('unbekannte Übungen und leere Daten brechen nichts', () => {
    const v = weeklyVolume([sess('2026-10-24', [{ exerciseId: 'gibt_es_nicht', sets: sets(3, 5, 50) }])], today);
    assert.ok(v.every((x) => x.status === 'none'));
    assert.equal(weeklyVolume([], today).length, MUSCLES.length);
  });
  it('Einordnung', () => {
    assert.equal(volumeStatus(0), 'none');
    assert.equal(volumeStatus(5.5), 'low');
    assert.equal(volumeStatus(6), 'productive');
    assert.equal(volumeStatus(20), 'productive');
    assert.equal(volumeStatus(20.5), 'high');
  });
});

describe('Regionen-Wochenlast', () => {
  it('nur harte Sätze der letzten 7 Tage, mit Region-Gewichten', () => {
    const l = weeklyRegionLoad([
      sess('2026-10-24', [{ exerciseId: 'incline_curl_30', sets: [...sets(3, 10, 12, 1), { reps: 10, weightKg: 4, warmup: true }, { reps: 10, weightKg: 12, rir: 6 }] }]),
      sess('2026-10-01', [{ exerciseId: 'incline_curl_30', sets: sets(5, 10, 12, 1) }]),
    ], '2026-10-25');
    assert.equal(l.biceps_long, 3);
    assert.equal(l.biceps_short, 1.5);
    assert.equal(l.chest_sternal, undefined);
  });
});

describe('Progression', () => {
  const bench = exerciseById('bench_press')!; // 5–10, +2,5 kg
  it('Last erhöhen, wenn alle Sätze die obere Grenze erreichen', () => {
    const a = progressionAdvice(sets(3, 10, 80, 1), bench);
    assert.equal(a.action, 'increase_load');
    assert.equal(a.nextWeightKg, 82.5);
    assert.equal(a.targetReps, 5);
  });
  it('sonst +1 Wiederholung', () => {
    const a = progressionAdvice([{ reps: 8, weightKg: 80, rir: 2 }, { reps: 7, weightKg: 80, rir: 2 }], bench);
    assert.equal(a.action, 'add_reps');
    assert.equal(a.targetReps, 8);
    assert.equal(a.nextWeightKg, 80);
  });
  it('Last senken unter der unteren Grenze, halten bei sehr hoher RIR, keine Daten', () => {
    assert.equal(progressionAdvice(sets(3, 4, 100, 1), bench).action, 'reduce');
    assert.equal(progressionAdvice(sets(3, 8, 60, 5), bench).action, 'hold');
    assert.equal(progressionAdvice([], bench).action, 'no_data');
    assert.equal(progressionAdvice([{ reps: 8, weightKg: 50, warmup: true }], bench).action, 'no_data');
  });
  it('erhöht nicht bei nur einem Satz auf Top-Gewicht', () => {
    const a = progressionAdvice([{ reps: 10, weightKg: 80, rir: 1 }], bench);
    assert.notEqual(a.action, 'increase_load');
  });
});

describe('Rekorde, Tonnage, Belastungsanbindung', () => {
  const s1 = sess('2026-10-20', [{ exerciseId: 'bench_press', sets: [...sets(3, 8, 80, 2), { reps: 12, weightKg: 40, warmup: true }] }], { durationMin: 60 });
  const s2 = sess('2026-10-23', [{ exerciseId: 'bench_press', sets: sets(3, 6, 90, 1) }]);
  it('Rekorde', () => {
    const pr = personalRecords([s1, s2]);
    assert.equal(pr.length, 1);
    assert.equal(pr[0].date, '2026-10-23');
    assert.equal(pr[0].e1rm, 111);
  });
  it('Tonnage ohne Aufwärmsätze', () => {
    assert.deepEqual(sessionTonnage(s1), { totalKg: 1920, hardSets: 3, workSets: 3 });
  });
  it('Session-RPE und Umwandlung in Workout mit geschätzter Last', () => {
    assert.equal(sessionRpe(s1), 8);
    const w = liftSessionToWorkout(s1)!;
    assert.equal(w.durationMin, 60);
    assert.equal(w.rpe, 8);
    assert.equal(workoutLoad(w)!.provenance, 'estimated');
    assert.equal(workoutLoad(w)!.load, 240);
  });
  it('keine erfundene Belastung ohne Dauer oder RIR', () => {
    assert.equal(liftSessionToWorkout(s2), undefined);
    assert.equal(liftSessionToWorkout(sess('2026-10-23', [{ exerciseId: 'bench_press', sets: [{ reps: 5, weightKg: 80 }] }], { durationMin: 40 })), undefined);
  });
});

describe('Trend', () => {
  it('zählt sinkende e1RM je Übung, ignoriert Übungen mit nur einer Einheit', () => {
    const a = sess('2026-10-01', [{ exerciseId: 'bench_press', sets: sets(3, 8, 80) }, { exerciseId: 'ohp', sets: sets(3, 8, 40) }]);
    const b = sess('2026-10-08', [{ exerciseId: 'bench_press', sets: sets(3, 8, 70) }]);
    assert.equal(e1rmDeclines([a, b]), 1);
    assert.equal(e1rmDeclines([a]), 0);
    assert.equal(e1rmDeclines([b, a]), 1);
  });
});

describe('Deload-Hinweis', () => {
  it('braucht mindestens zwei Gründe', () => {
    assert.equal(deloadHint({ weeksSinceDeload: 8 }).suggest, false);
    assert.equal(deloadHint({ weeksSinceDeload: 8, recoveryAvg7d: 40 }).suggest, true);
    assert.equal(deloadHint({ recoveryAvg7d: 40, e1rmDeclineLifts: 3 }).suggest, true);
    assert.equal(deloadHint({}).suggest, false);
  });
});

describe('Aktivitäten', () => {
  it('Katalog konsistent', () => {
    assert.equal(new Set(ACTIVITY_KINDS.map((k) => k.id)).size, ACTIVITY_KINDS.length);
    for (const k of ACTIVITY_KINDS) assert.ok(k.met.leicht < k.met.mittel && k.met.mittel < k.met.hart, k.id);
  });
  it('kcal-Schätzung nur mit gültigem Gewicht und Dauer', () => {
    assert.equal(estimateKcal('running', 'mittel', 60, 70), 665);
    assert.equal(estimateKcal('running', 'mittel', 60, undefined), undefined);
    assert.equal(estimateKcal('running', 'mittel', 0, 70), undefined);
    assert.equal(estimateKcal('running', 'mittel', 60, 10), undefined);
    assert.equal(estimateKcal('unbekannt', 'mittel', 60, 70), undefined);
  });
  it('Intensität aus RPE und Zuordnung des Typtexts', () => {
    assert.equal(intensityFromRpe(3), 'leicht');
    assert.equal(intensityFromRpe(6), 'mittel');
    assert.equal(intensityFromRpe(9), 'hart');
    assert.equal(kindFromLabel('laufen')?.id, 'running');
    assert.equal(kindFromLabel('Quatsch'), undefined);
  });
});
