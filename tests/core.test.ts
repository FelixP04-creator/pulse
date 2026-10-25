import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { baselineFor, MIN_BASELINE_DAYS, zScore } from '../src/core/baselines.ts';
import { recoveryBand, recoveryScore } from '../src/core/recovery.ts';
import { asleepMinutes, formatShiftedClock, shiftedClockMinutes, sleepConsistency, sleepDebt, sleepEfficiency, sleepNeedMin, sleepScore } from '../src/core/sleep.ts';
import { addDays, dateRange, daysBetween, isPlausible, median, robustSigma, stdev } from '../src/core/stats.ts';
import { dailyStrain, edwardsLoad, estimateHrMax, loadBalance, strainFromLoad, strainSeries, workoutLoad, zoneMinutesFromHr } from '../src/core/strain.ts';
import type { DailyMetrics, SleepNight, Workout } from '../src/core/types.ts';
import { physiologicalAgeIndicator, vitalityIndex, type ValidatedAgeModel } from '../src/core/vitality.ts';
import { generateDemoDataset } from '../src/data/demo.ts';

const TODAY = '2026-10-24';

/** Stabile Testdaten: n Tage bis TODAY mit konstanten (leicht alternierenden) Werten. */
function makeDays(n: number, f: (i: number, date: string) => Partial<DailyMetrics> = () => ({})): DailyMetrics[] {
  return Array.from({ length: n }, (_, k) => {
    const date = addDays(TODAY, -(n - 1 - k));
    return { date, restingHr: 54 + (k % 3) - 1, hrvMs: 62 + (k % 4) - 1.5, activeMinutes: 25, ...f(k, date) };
  });
}

function makeNights(n: number, f: (i: number, date: string) => Partial<SleepNight> = () => ({})): SleepNight[] {
  return Array.from({ length: n }, (_, k) => {
    const date = addDays(TODAY, -(n - 1 - k));
    return {
      date,
      start: `${addDays(date, -1)}T23:00:00`,
      end: `${date}T06:50:00`,
      inBedMin: 470,
      asleepMin: 440,
      ...f(k, date),
    };
  });
}

describe('stats', () => {
  it('Datumshilfen sind kalenderbasiert', () => {
    assert.equal(addDays('2026-10-25', 1), '2026-10-26');
    assert.equal(addDays('2026-03-29', 1), '2026-03-30'); // Zeitumstellung darf nichts verschieben
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(daysBetween('2026-10-01', '2026-10-24'), 23);
    assert.deepEqual(dateRange('2026-10-22', '2026-10-24'), ['2026-10-22', '2026-10-23', '2026-10-24']);
    assert.deepEqual(dateRange('2026-10-24', '2026-10-22'), []);
  });
  it('median/stdev/robustSigma', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), undefined);
    assert.equal(stdev([1]), undefined);
    assert.ok(Math.abs((stdev([2, 4, 4, 4, 5, 5, 7, 9]) as number) - 2.138) < 0.01);
    assert.ok((robustSigma([1, 2, 3, 4, 1000]) as number) < 5, 'Ausreißer dürfen die robuste σ nicht dominieren');
  });
  it('Plausibilität erkennt unmögliche Werte', () => {
    assert.equal(isPlausible('restingHr', 55), true);
    assert.equal(isPlausible('restingHr', 5), false);
    assert.equal(isPlausible('spo2', 120), false);
    assert.equal(isPlausible('hrvMs', NaN), false);
    assert.equal(isPlausible('hrvMs', undefined), false);
  });
});

describe('baselines', () => {
  it('liefert erst ab MIN_BASELINE_DAYS gültigen Werten eine Basis', () => {
    const few = makeDays(MIN_BASELINE_DAYS - 1);
    assert.equal(baselineFor(few, 'hrvMs', addDays(TODAY, 1)), undefined);
    const enough = makeDays(MIN_BASELINE_DAYS);
    assert.ok(baselineFor(enough, 'hrvMs', addDays(TODAY, 1)));
  });
  it('schließt den betrachteten Tag selbst aus', () => {
    const days = makeDays(30, (k) => (k === 29 ? { hrvMs: 500 } : {}));
    const b = baselineFor(days, 'hrvMs', TODAY)!;
    assert.ok(b.center < 70);
    assert.equal(b.n, 29 - 0); // 29 Vortage; heutiger Wert fehlt in der Basis
  });
  it('ignoriert unplausible Werte', () => {
    const days = makeDays(30, (k) => (k % 5 === 0 ? { hrvMs: 9999 } : {}));
    const b = baselineFor(days, 'hrvMs', addDays(TODAY, 1))!;
    assert.ok(b.center < 70 && b.n < 30);
  });
  it('z-Werte sind auf ±3 begrenzt und Streuung hat Untergrenze', () => {
    const flat = makeDays(30, () => ({ restingHr: 55 }));
    const b = baselineFor(flat, 'restingHr', addDays(TODAY, 1))!;
    assert.ok(b.spread >= 1.5);
    assert.equal(zScore(200, b), 3);
    assert.equal(zScore(1, b), -3);
  });
});

describe('Schlaf', () => {
  it('Schlafbedarf: persönliches Ziel > Alter > Standard', () => {
    assert.equal(sleepNeedMin({ sleepTargetMin: 420, age: 70 }).minutes, 420);
    assert.equal(sleepNeedMin({ age: 70 }).minutes, 450);
    assert.equal(sleepNeedMin({ age: 16 }).minutes, 540);
    assert.equal(sleepNeedMin({}).minutes, 480);
    assert.equal(sleepNeedMin({}).provenance, 'estimated');
  });
  it('Uhrzeiten über Mitternacht sind kontinuierlich', () => {
    const a = shiftedClockMinutes('2026-10-23T23:30:00') as number;
    const b = shiftedClockMinutes('2026-10-24T00:30:00') as number;
    assert.equal(b - a, 60);
    assert.equal(formatShiftedClock(a), '23:30');
    assert.equal(shiftedClockMinutes('kaputt'), undefined);
  });
  it('Konsistenz: regelmäßig ≫ unregelmäßig; <5 Nächte → undefined', () => {
    const regular = sleepConsistency(makeNights(14), TODAY)!;
    assert.ok(regular.score > 98);
    const chaotic = sleepConsistency(makeNights(14, (k) => ({ start: `${addDays(addDays(TODAY, -(13 - k)), -1)}T${k % 2 ? '21:00' : '01:30'}:00`, end: `${addDays(TODAY, -(13 - k))}T${k % 2 ? '05:00' : '10:30'}:00` })), TODAY)!;
    assert.ok(chaotic.score < regular.score - 40);
    assert.equal(sleepConsistency(makeNights(4), TODAY), undefined);
  });
  it('Effizienz nur bei echter Schlafzeit', () => {
    assert.ok(Math.abs((sleepEfficiency({ ...makeNights(1)[0] }) as number) - 440 / 470) < 1e-9);
    assert.equal(sleepEfficiency({ ...makeNights(1)[0], asleepMin: undefined }), undefined);
    assert.equal(sleepEfficiency({ ...makeNights(1)[0], asleepIsEstimate: true }), undefined);
    assert.equal(sleepEfficiency({ ...makeNights(1)[0], asleepMin: 600 }), undefined, 'mehr Schlaf als Bettzeit ist unplausibel');
  });
  it('Schlafwert: Gewichte summieren zu 1, Reproduzierbarkeit', () => {
    const n = makeNights(14);
    const a = sleepScore(n, TODAY);
    const b = sleepScore(n, TODAY);
    assert.deepEqual(a, b);
    assert.equal(a.status, 'ok');
    if (a.status === 'ok') {
      assert.ok(Math.abs(a.components.reduce((s, c) => s + c.weight, 0) - 1) < 1e-3);
      assert.equal(a.components.length, 3);
      assert.ok(a.value > 90 && a.value <= 100);
      assert.equal(a.quality, 'high');
    }
  });
  it('Schlafwert ohne Konsistenz-Daten: Umverteilung + Hinweis', () => {
    const r = sleepScore(makeNights(2), TODAY);
    assert.equal(r.status, 'ok');
    if (r.status === 'ok') {
      assert.equal(r.components.length, 2);
      assert.ok(r.notes.some((t) => t.includes('Regelmäßigkeit')));
    }
  });
  it('Schlafzeit nur aus Bettzeit → als Schätzung gekennzeichnet; keine erfundenen Phasen', () => {
    const n = makeNights(1, () => ({ asleepMin: undefined, asleepIsEstimate: true }));
    const r = sleepScore(n, TODAY);
    assert.equal(r.status, 'ok');
    if (r.status === 'ok') {
      assert.equal(r.provenance, 'estimated');
      assert.equal(n[0].stages, undefined);
    }
  });
  it('fehlende Nacht → insufficient statt erfundenem Wert', () => {
    const r = sleepScore(makeNights(5).slice(0, -1), TODAY);
    assert.equal(r.status, 'insufficient');
  });
  it('unplausible Schlafdauer wird verworfen', () => {
    assert.equal(asleepMinutes({ ...makeNights(1)[0], asleepMin: 5 }), undefined);
    assert.equal(sleepScore(makeNights(1, () => ({ asleepMin: 3000, inBedMin: 3100 })), TODAY).status, 'insufficient');
  });
  it('Schlafdefizit: ≥4 Nächte nötig, nur Unterschreitungen zählen', () => {
    assert.equal(sleepDebt(makeNights(3), TODAY), undefined);
    const d = sleepDebt(makeNights(7, (k) => ({ asleepMin: k % 2 ? 540 : 420 })), TODAY)!;
    assert.equal(d.nightsCounted, 7);
    assert.equal(d.debtMin, 60 * 4); // 4 Nächte × 60 min unter 480
  });
});

describe('Recovery', () => {
  const nights = makeNights(40);
  it('ohne ausreichende Basis: „Nicht genügend Daten“ statt Score', () => {
    const r = recoveryScore(makeDays(MIN_BASELINE_DAYS), nights, TODAY);
    assert.equal(r.status, 'insufficient');
    if (r.status === 'insufficient') assert.match(r.reason, /Nicht genügend Daten/);
  });
  it('fehlende Tageswerte oder Schlaf → insufficient', () => {
    const days = makeDays(40).filter((d) => d.date !== TODAY);
    assert.equal(recoveryScore(days, nights, TODAY).status, 'insufficient');
    assert.equal(recoveryScore(makeDays(40), nights.slice(0, -1), TODAY).status, 'insufficient');
  });
  it('unplausibler heutiger Wert → kein Score', () => {
    const days = makeDays(40, (k) => (k === 39 ? { hrvMs: 9999 } : {}));
    assert.equal(recoveryScore(days, nights, TODAY).status, 'insufficient');
  });
  it('Richtung: hohe HRV/niedriger Puls → hoher Score; umgekehrt → niedriger', () => {
    const good = recoveryScore(makeDays(40, (k) => (k === 39 ? { hrvMs: 85, restingHr: 49 } : {})), nights, TODAY);
    const bad = recoveryScore(makeDays(40, (k) => (k === 39 ? { hrvMs: 40, restingHr: 62 } : {})), nights, TODAY);
    const mid = recoveryScore(makeDays(40), nights, TODAY);
    assert.ok(good.status === 'ok' && bad.status === 'ok' && mid.status === 'ok');
    if (good.status === 'ok' && bad.status === 'ok' && mid.status === 'ok') {
      assert.ok(good.value > mid.value && mid.value > bad.value, `${good.value} > ${mid.value} > ${bad.value}`);
      assert.ok(good.value <= 100 && bad.value >= 0);
    }
  });
  it('Gewichte summieren zu 1; Score ist reproduzierbar', () => {
    const days = makeDays(40);
    const a = recoveryScore(days, nights, TODAY);
    assert.deepEqual(a, recoveryScore(days, nights, TODAY));
    if (a.status === 'ok') assert.ok(Math.abs(a.components.reduce((s, c) => s + c.weight, 0) - 1) < 1e-3);
  });
  it('Bänder', () => {
    assert.equal(recoveryBand(10), 'low');
    assert.equal(recoveryBand(50), 'moderate');
    assert.equal(recoveryBand(90), 'high');
  });
});

describe('Strain', () => {
  it('Edwards-Last und Abbildung auf 0–21', () => {
    assert.equal(edwardsLoad([0, 0, 60, 0, 0]), 180);
    assert.equal(strainFromLoad(0), 0);
    assert.ok(Math.abs(strainFromLoad(180) - 10.8) < 0.1);
    assert.ok(strainFromLoad(1e9) <= 21);
    assert.ok(strainFromLoad(-5) === 0);
  });
  it('Zonen aus Herzfrequenz (HRR)', () => {
    // HRmax 190, Ruhe 50 → HRR 140: 50 %=120, 60 %=134, 70 %=148, 80 %=162, 90 %=176
    const z = zoneMinutesFromHr([100, 125, 140, 150, 165, 180, 119], 190, 50);
    assert.deepEqual(z, [1, 1, 1, 1, 1]);
    assert.deepEqual(zoneMinutesFromHr([150], 190, 185), [0, 0, 0, 0, 0], 'ungültige Reserve → keine Zonen');
  });
  it('HRmax: manuell > Tanaka-Schätzung > unbekannt', () => {
    assert.deepEqual(estimateHrMax({ hrMax: 185 }), { value: 185, provenance: 'manual' });
    assert.deepEqual(estimateHrMax({ age: 40 }), { value: 180, provenance: 'estimated' });
    assert.equal(estimateHrMax({}), undefined);
  });
  it('RPE-Schätzung ist als Schätzung markiert, Zonen sind berechnet', () => {
    const w: Workout = { id: 'a', source: 'manual', type: 'Yoga', start: `${TODAY}T08:00:00`, durationMin: 60, rpe: 6 };
    assert.deepEqual(workoutLoad(w), { workoutId: 'a', load: 180, provenance: 'estimated' });
    const w2: Workout = { ...w, id: 'b', source: 'device', zoneMinutes: [0, 0, 60, 0, 0] };
    assert.equal(workoutLoad(w2)?.provenance, 'calculated');
    assert.equal(workoutLoad({ ...w, rpe: undefined }), undefined);
  });
  it('Tagesbelastung trennt Tage; Ruhetag = 0 mit Hinweis; Einheiten ohne Daten werden gemeldet', () => {
    const ws: Workout[] = [
      { id: '1', source: 'device', type: 'Laufen', start: `${TODAY}T07:00:00`, durationMin: 60, zoneMinutes: [0, 0, 60, 0, 0] },
      { id: '2', source: 'manual', type: 'Spaziergang', start: `${TODAY}T18:00:00`, durationMin: 30 },
      { id: '3', source: 'device', type: 'Laufen', start: `${addDays(TODAY, -1)}T07:00:00`, durationMin: 60, zoneMinutes: [0, 0, 60, 0, 0] },
    ];
    const t = dailyStrain(ws, TODAY);
    assert.ok(t.status === 'ok' && Math.abs(t.value - 10.8) < 0.1);
    if (t.status === 'ok') assert.ok(t.notes.some((n) => n.includes('nicht berücksichtigt')));
    const rest = dailyStrain(ws, addDays(TODAY, -3));
    assert.ok(rest.status === 'ok' && rest.value === 0 && rest.notes.length > 0);
    const series = strainSeries(ws, TODAY, 3);
    assert.equal(series.length, 3);
    assert.equal(series[2].date, TODAY);
    assert.equal(series[0].strain, 0);
  });
  it('Belastung vs. Erholung', () => {
    assert.equal(loadBalance(undefined, 50), 'insufficient');
    assert.equal(loadBalance(5, 80), 'room');
    assert.equal(loadBalance(15, 20), 'strained');
    assert.equal(loadBalance(10, 50), 'balanced');
  });
});

describe('Vitalitätsindex', () => {
  it('zu wenig Verlauf → insufficient', () => {
    const r = vitalityIndex(makeDays(10), makeNights(10), TODAY);
    assert.equal(r.status, 'insufficient');
  });
  it('liefert Wert, Unsicherheit und Gewichte (Summe 1) bei ausreichenden Daten', () => {
    const r = vitalityIndex(makeDays(120, () => ({ activeMinutes: 30 })), makeNights(120), TODAY);
    assert.equal(r.status, 'ok');
    if (r.status === 'ok') {
      assert.ok(r.value >= 0 && r.value <= 100);
      assert.ok(r.uncertainty >= 5);
      assert.ok(Math.abs(r.components.reduce((s, c) => s + c.weight, 0) - 1) < 1e-3);
      assert.ok(r.notes.some((n) => n.includes('Cardio-Fitness'))); // VO₂max fehlt → Hinweis
      assert.ok(r.coverage < 1 && r.coverage > 0.8);
    }
  });
  it('Entwicklung: sinkende HRV senkt, steigende HRV erhöht den Index', () => {
    const nights = makeNights(150);
    const base = (f: (k: number) => number) => makeDays(150, (k) => ({ hrvMs: f(k), activeMinutes: 25 }));
    const up = vitalityIndex(base((k) => (k >= 122 ? 80 : 60)), nights, TODAY);
    const down = vitalityIndex(base((k) => (k >= 122 ? 40 : 60)), nights, TODAY);
    assert.ok(up.status === 'ok' && down.status === 'ok');
    if (up.status === 'ok' && down.status === 'ok') assert.ok(up.value > down.value);
  });
  it('Unplausible Werte verfälschen den Index nicht', () => {
    const nights = makeNights(150);
    const clean = vitalityIndex(makeDays(150), nights, TODAY);
    const dirty = vitalityIndex(makeDays(150, (k) => (k % 10 === 0 ? { restingHr: 400, hrvMs: 9999 } : {})), nights, TODAY);
    assert.ok(clean.status === 'ok' && dirty.status === 'ok');
    if (clean.status === 'ok' && dirty.status === 'ok') assert.ok(Math.abs(clean.value - dirty.value) <= 3);
  });
});

describe('Physiologischer Altersindikator (gesperrt)', () => {
  it('ohne validiertes Modell gibt es niemals einen Zahlenwert', () => {
    const r = physiologicalAgeIndicator({ calendarAge: 40, vo2max: 45, restingHr: 52, hrvMs: 60 });
    assert.equal(r.status, 'unavailable');
    assert.equal('ageYears' in r, false);
  });
  const model: ValidatedAgeModel = {
    id: 'test-model',
    citation: 'Beispielstudie (nur Test)',
    validatedFor: 'nur Testzwecke',
    requiredInputs: ['calendarAge', 'vo2max'],
    estimate: (i) => ({ ageYears: (i.calendarAge as number) - 2, uncertaintyYears: 5 }),
  };
  it('mit Modell: nur bei vollständigen, plausiblen Eingaben und mit Unsicherheit', () => {
    assert.equal(physiologicalAgeIndicator({ calendarAge: 40 }, model).status, 'unavailable');
    assert.equal(physiologicalAgeIndicator({ calendarAge: 40, vo2max: 400 }, model).status, 'unavailable');
    const ok = physiologicalAgeIndicator({ calendarAge: 40, vo2max: 45 }, model);
    assert.equal(ok.status, 'ok');
    if (ok.status === 'ok') {
      assert.equal(ok.ageYears, 38);
      assert.equal(ok.uncertaintyYears, 5);
      assert.equal(ok.provenance, 'estimated');
    }
  });
  it('Modell ohne Quelle oder ohne Unsicherheit wird abgelehnt', () => {
    assert.equal(physiologicalAgeIndicator({ calendarAge: 40, vo2max: 45 }, { ...model, citation: ' ' }).status, 'unavailable');
    assert.equal(physiologicalAgeIndicator({ calendarAge: 40, vo2max: 45 }, { ...model, estimate: () => ({ ageYears: 39, uncertaintyYears: 0 }) }).status, 'unavailable');
  });
});

describe('Demo-Daten', () => {
  const a = generateDemoDataset(TODAY);
  it('sind deterministisch und als Demo markiert', () => {
    assert.deepEqual(a, generateDemoDataset(TODAY));
    assert.equal(a.origin, 'demo');
    assert.equal(a.lastSyncAt, undefined, 'Demo darf keine Synchronisierung vortäuschen');
  });
  it('enthalten bewusst Lücken, aber heutige Werte', () => {
    assert.ok(a.days.length < 400 && a.days.length > 370);
    assert.ok(a.days.some((d) => d.date === TODAY));
    assert.ok(a.nights.some((n) => n.date === TODAY));
  });
  it('alle Werte sind plausibel', () => {
    for (const d of a.days) {
      assert.ok(isPlausible('restingHr', d.restingHr), `RHR ${d.restingHr}`);
      assert.ok(isPlausible('hrvMs', d.hrvMs), `HRV ${d.hrvMs}`);
    }
    for (const n of a.nights) assert.ok(asleepMinutes(n) !== undefined);
  });
  it('alle Hauptscores sind mit Demo-Daten berechenbar', () => {
    const rec = recoveryScore(a.days, a.nights, TODAY);
    const slp = sleepScore(a.nights, TODAY);
    const vit = vitalityIndex(a.days, a.nights, TODAY);
    const str = dailyStrain(a.workouts, TODAY);
    assert.equal(rec.status, 'ok');
    assert.equal(slp.status, 'ok');
    assert.equal(vit.status, 'ok');
    assert.equal(str.status, 'ok');
    if (rec.status === 'ok') assert.ok(rec.value >= 0 && rec.value <= 100);
  });
});
