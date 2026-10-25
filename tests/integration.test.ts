import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { FOOD_ANALYSIS_PROMPT as APP_PROMPT } from '../src/core/foodAnalysis.ts';
import { FOOD_ANALYSIS_PROMPT as SERVER_PROMPT } from '../supabase/functions/_shared/foodPrompt.ts';
import { zoneMinutesFromHr as coreZones } from '../src/core/strain.ts';
import { FITBIT_AIR_DATA_TYPES, REQUIRED_SCOPES, SCOPES, initialStatus } from '../supabase/functions/_shared/catalog.ts';
import {
  GoogleApiError, GoogleHealthClient, buildAuthUrl, dailyFilter, exchangeCode, filterFieldCandidates, intervalFilter, refreshAccessToken, sleepFilter,
  type FetchLike,
} from '../supabase/functions/_shared/client.ts';
import { decryptSecret, encryptSecret, signState, timingSafeEqual, verifyState } from '../supabase/functions/_shared/crypto.ts';
import { applyPoint, civilDate, civilDateTime, heartRatePerMinute, mapExercises, mapSleep, pickNumber, zoneMinutesFromHr } from '../supabase/functions/_shared/mapper.ts';
import { addDays, runSync } from '../supabase/functions/_shared/sync.ts';
import type { DailyMetricsRow } from '../supabase/functions/_shared/types.ts';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const noSleep = async () => {};

describe('Krypto', () => {
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  it('AES-GCM: Roundtrip, zufälliger IV, Manipulation wird erkannt', async () => {
    const a = await encryptSecret('refresh-token-123', key);
    const b = await encryptSecret('refresh-token-123', key);
    assert.notEqual(a, b);
    assert.equal(await decryptSecret(a, key), 'refresh-token-123');
    assert.ok(!a.includes('refresh-token-123'));
    const tampered = a.slice(0, -4) + (a.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await assert.rejects(() => decryptSecret(tampered, key));
    await assert.rejects(() => decryptSecret(a, Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')));
  });
  it('lehnt Schlüssel falscher Länge ab', async () => {
    await assert.rejects(() => encryptSecret('x', Buffer.from('zu-kurz').toString('base64')), /32 Byte/);
  });
  it('OAuth-State: gültig, abgelaufen, manipuliert, falsches Secret', async () => {
    const now = 1_800_000_000;
    const s = await signState({ uid: 'u1', nonce: 'n', exp: now + 600 }, 'secret');
    assert.equal((await verifyState(s, 'secret', now))?.uid, 'u1');
    assert.equal(await verifyState(s, 'secret', now + 601), null);
    assert.equal(await verifyState(s, 'anderes', now), null);
    const [body, sig] = s.split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 'angreifer', nonce: 'n', exp: now + 600 })).toString('base64url');
    assert.equal(await verifyState(`${forged}.${sig}`, 'secret', now), null);
    assert.equal(await verifyState('müll', 'secret', now), null);
    assert.ok(body);
  });
  it('timingSafeEqual', () => {
    assert.equal(timingSafeEqual('Bearer abc', 'Bearer abc'), true);
    assert.equal(timingSafeEqual('Bearer abc', 'Bearer abd'), false);
    assert.equal(timingSafeEqual('a', 'ab'), false);
  });
});

describe('OAuth-Helfer', () => {
  it('Auth-URL fordert nur Leserechte an, offline-Zugriff, kein Fremd-Scope', () => {
    const u = new URL(buildAuthUrl({ clientId: 'cid', redirectUri: 'https://x.test/cb' }, REQUIRED_SCOPES, 'st'));
    const scopes = u.searchParams.get('scope')!.split(' ');
    assert.deepEqual(scopes.sort(), [...REQUIRED_SCOPES].sort());
    assert.ok(scopes.every((s) => s.endsWith('.readonly')), 'keine Schreibrechte');
    assert.ok(!scopes.some((s) => /location|ecg|irn|profile|nutrition|settings/.test(s)), 'keine unnötigen Rechte');
    assert.equal(u.searchParams.get('access_type'), 'offline');
    assert.equal(u.searchParams.get('state'), 'st');
    assert.equal(u.searchParams.get('response_type'), 'code');
  });
  it('Token-Austausch und -Erneuerung; invalid_grant wird als nicht wiederholbar gemeldet', async () => {
    const ok: FetchLike = async (_u, init) => {
      const b = new URLSearchParams(String(init?.body));
      return json({ access_token: 'AT', refresh_token: b.get('grant_type') === 'authorization_code' ? 'RT' : undefined, expires_in: 3599, scope: `${SCOPES.sleep} ${SCOPES.metrics}` });
    };
    const cfg = { clientId: 'c', clientSecret: 's', redirectUri: 'r' };
    const t = await exchangeCode(cfg, 'code', ok);
    assert.deepEqual([t.accessToken, t.refreshToken, t.expiresInSec, t.scopes.length], ['AT', 'RT', 3599, 2]);
    const r = await refreshAccessToken(cfg, 'RT', ok);
    assert.equal(r.refreshToken, undefined);
    const bad: FetchLike = async () => json({ error: 'invalid_grant' }, 400);
    await assert.rejects(() => refreshAccessToken(cfg, 'RT', bad), (e: unknown) => e instanceof GoogleApiError && e.code === 'invalid_grant' && e.retryable === false);
  });
});

describe('API-Client', () => {
  it('durchläuft alle Seiten', async () => {
    const calls: string[] = [];
    const f: FetchLike = async (u) => {
      calls.push(u);
      const tok = new URL(u).searchParams.get('pageToken');
      return tok ? json({ dataPoints: [{ n: 2 }] }) : json({ dataPoints: [{ n: 1 }], nextPageToken: 'P2' });
    };
    const c = new GoogleHealthClient('AT', { fetchFn: f, sleep: noSleep });
    const all = await c.listAll({ dataType: 'steps', filter: 'x', pageSize: 10 });
    assert.equal(all.length, 2);
    assert.ok(calls[0].startsWith('https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints?'));
  });
  it('wiederholt bei 429 mit Retry-After und gibt nach maxRetries auf', async () => {
    let n = 0;
    const waits: number[] = [];
    const f: FetchLike = async () => (++n < 3 ? json({ error: { message: 'quota' } }, 429, { 'retry-after': '2' }) : json({ dataPoints: [{}] }));
    const c = new GoogleHealthClient('AT', { fetchFn: f, sleep: async (ms) => void waits.push(ms) });
    assert.equal((await c.listAll({ dataType: 'steps' })).length, 1);
    assert.deepEqual(waits, [2000, 2000]);
    const always429: FetchLike = async () => json({}, 429);
    const c2 = new GoogleHealthClient('AT', { fetchFn: always429, sleep: noSleep, maxRetries: 2 });
    await assert.rejects(() => c2.listAll({ dataType: 'steps' }), (e: unknown) => e instanceof GoogleApiError && e.status === 429);
    assert.equal(c2.requestCount, 3);
  });
  it('Backoff wächst exponentiell, ist nach oben begrenzt', () => {
    const r = () => 1;
    assert.equal(GoogleHealthClient.backoffMs(0, null, r), 1000);
    assert.equal(GoogleHealthClient.backoffMs(2, null, r), 4000);
    assert.equal(GoogleHealthClient.backoffMs(20, null, r), 30000);
    assert.equal(GoogleHealthClient.backoffMs(0, '999', r), 60000);
  });
  it('erneuert das Token bei 401 genau einmal', async () => {
    let refreshCalls = 0;
    const seen: string[] = [];
    const f: FetchLike = async (_u, init) => {
      const a = (init?.headers as Record<string, string>).authorization;
      seen.push(a);
      return a === 'Bearer NEW' ? json({ dataPoints: [] }) : json({}, 401);
    };
    const c = new GoogleHealthClient('OLD', { fetchFn: f, sleep: noSleep, onUnauthorized: async () => (++refreshCalls, 'NEW') });
    await c.listAll({ dataType: 'steps' });
    assert.deepEqual(seen, ['Bearer OLD', 'Bearer NEW']);
    const still401: FetchLike = async () => json({}, 401);
    const c2 = new GoogleHealthClient('OLD', { fetchFn: still401, sleep: noSleep, onUnauthorized: async () => (++refreshCalls, 'NEW') });
    await assert.rejects(() => c2.listAll({ dataType: 'steps' }), (e: unknown) => e instanceof GoogleApiError && e.status === 401);
    assert.equal(refreshCalls, 2);
  });
  it('probiert bei 400 die alternative Filter-Schreibweise', async () => {
    const filters: string[] = [];
    const f: FetchLike = async (u) => {
      const fl = new URL(u).searchParams.get('filter')!;
      filters.push(fl);
      return fl.startsWith('daily_resting_heart_rate') ? json({ error: { message: 'bad filter' } }, 400) : json({ dataPoints: [{ ok: 1 }] });
    };
    const c = new GoogleHealthClient('AT', { fetchFn: f, sleep: noSleep });
    const r = await c.listWithFilter('daily-resting-heart-rate', 'dailyRestingHeartRate', (x) => dailyFilter(x, '2026-10-01', '2026-10-24'));
    assert.equal(r.length, 1);
    assert.equal(filters.length, 2);
    assert.ok(filters[1].startsWith('dailyRestingHeartRate.date >= "2026-10-01"'));
    assert.deepEqual(filterFieldCandidates('steps'), ['steps']);
  });
  it('Filter-Strings entsprechen den dokumentierten Beispielen', () => {
    assert.equal(intervalFilter('steps', '2023-11-24', '2023-11-25'), 'steps.interval.civil_start_time >= "2023-11-24" AND steps.interval.civil_start_time < "2023-11-25"');
    assert.equal(sleepFilter('sleep', '2023-11-24', '2023-11-25'), 'sleep.interval.civil_end_time >= "2023-11-24" AND sleep.interval.civil_end_time < "2023-11-25"');
    assert.equal(dailyFilter('dailyHeartRateVariability', '2024-08-01', '2024-08-15'), 'dailyHeartRateVariability.date >= "2024-08-01" AND dailyHeartRateVariability.date < "2024-08-15"');
  });
});

describe('Mapper (Einheiten, Zeiträume, fehlende Felder)', () => {
  it('Zivildatum/-zeit', () => {
    assert.equal(civilDate({ year: 2026, month: 3, day: 9 }), '2026-03-09');
    assert.equal(civilDate('2026-10-24'), '2026-10-24');
    assert.equal(civilDate({ date: { year: 2026, month: 10, day: 24 } }), '2026-10-24');
    assert.equal(civilDate('nope'), undefined);
    assert.equal(civilDateTime({ year: 2026, month: 10, day: 23, hours: 23, minutes: 5 }), '2026-10-23T23:05:00');
    assert.equal(civilDateTime({ date: { year: 2026, month: 10, day: 23 }, time: { hours: 6, minutes: 30 } }), '2026-10-23T06:30:00');
    assert.equal(civilDateTime('2026-10-23T23:05'), '2026-10-23T23:05:00');
  });
  it('Tageswerte: int64-Strings werden zu Zahlen, Einheiten bleiben bpm/ms', () => {
    const acc = new Map<string, DailyMetricsRow>();
    const w: string[] = [];
    applyPoint(acc, 'daily-resting-heart-rate', { dailyRestingHeartRate: { date: { year: 2026, month: 10, day: 24 }, beatsPerMinute: '52' } }, w);
    applyPoint(acc, 'daily-heart-rate-variability', { dailyHeartRateVariability: { date: { year: 2026, month: 10, day: 24 }, averageHeartRateVariabilityMilliseconds: 64.2, entropy: 2 } }, w);
    const r = acc.get('2026-10-24')!;
    assert.equal(r.restingHr, 52);
    assert.equal(r.hrvMs, 64.2);
    assert.deepEqual(w, []);
  });
  it('Schritte werden je Kalendertag summiert (Zivilzeit)', () => {
    const acc = new Map<string, DailyMetricsRow>();
    const w: string[] = [];
    const mk = (h: number, count: string) => ({ steps: { count, interval: { startTime: `2026-10-23T${String(h).padStart(2, '0')}:00:00Z`, endTime: `2026-10-23T${String(h).padStart(2, '0')}:01:00Z`, civilStartTime: { year: 2026, month: 10, day: 24, hours: h, minutes: 0 } } } });
    applyPoint(acc, 'steps', mk(1, '100'), w);
    applyPoint(acc, 'steps', mk(2, '250'), w);
    assert.equal(acc.get('2026-10-24')!.steps, 350, 'Tageszuordnung folgt der Zivilzeit, nicht UTC');
    assert.deepEqual(w, []);
  });
  it('UTC-Fallback wird gemeldet', () => {
    const acc = new Map<string, DailyMetricsRow>();
    const w: string[] = [];
    applyPoint(acc, 'steps', { steps: { count: '10', interval: { startTime: '2026-10-23T22:00:00Z', endTime: '2026-10-23T22:01:00Z' } } }, w);
    assert.ok(w.some((m) => m.includes('UTC')));
  });
  it('unbekannte Wertfelder: kein erfundener Wert, aber Warnung', () => {
    const acc = new Map<string, DailyMetricsRow>();
    const w: string[] = [];
    applyPoint(acc, 'daily-oxygen-saturation', { dailyOxygenSaturation: { date: { year: 2026, month: 10, day: 24 }, irgendwas: 1 } }, w);
    assert.equal(acc.size, 0);
    assert.equal(w.length, 1);
    applyPoint(acc, 'daily-oxygen-saturation', { dailyOxygenSaturation: { date: { year: 2026, month: 10, day: 24 }, averagePercentage: 96.4 } }, w);
    assert.equal(acc.get('2026-10-24')!.spo2, 96.4);
  });
  it('pickNumber akzeptiert verschachtelte Pfade und Zahlen-Strings', () => {
    assert.equal(pickNumber({ a: { b: '7' } }, ['x', 'a.b']), 7);
    assert.equal(pickNumber({ a: 'abc' }, ['a']), undefined);
  });
  const night = (start: string, end: string, extra: Record<string, unknown> = {}) => ({
    name: `users/me/dataTypes/sleep/dataPoints/${start}`,
    sleep: { interval: { startTime: `${start}:00Z`, endTime: `${end}:00Z`, civilStartTime: { year: +start.slice(0, 4), month: +start.slice(5, 7), day: +start.slice(8, 10), hours: +start.slice(11, 13), minutes: +start.slice(14, 16) }, civilEndTime: { year: +end.slice(0, 4), month: +end.slice(5, 7), day: +end.slice(8, 10), hours: +end.slice(11, 13), minutes: +end.slice(14, 16) } }, ...extra },
  });
  it('Schlaf ohne Phasen: keine Phasen, Schlafzeit nur als Schätzung', () => {
    const { rows } = mapSleep([night('2026-10-23T23:00', '2026-10-24T07:00')]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, '2026-10-24');
    assert.equal(rows[0].inBedMin, 480);
    assert.equal(rows[0].stages, undefined);
    assert.equal(rows[0].asleepMin, undefined);
    assert.equal(rows[0].asleepIsEstimate, true);
    assert.equal(rows[0].startLocal, '2026-10-23T23:00:00');
  });
  it('Schlaf mit lesbaren Phasen: Summen und Schlafzeit', () => {
    const st = (type: string, a: string, b: string) => ({ type, startTime: `${a}:00Z`, endTime: `${b}:00Z` });
    const { rows } = mapSleep([night('2026-10-23T23:00', '2026-10-24T07:00', { stages: [st('AWAKE', '2026-10-23T23:00', '2026-10-23T23:30'), st('LIGHT', '2026-10-23T23:30', '2026-10-24T03:30'), st('DEEP', '2026-10-24T03:30', '2026-10-24T05:00'), st('REM', '2026-10-24T05:00', '2026-10-24T07:00')] })]);
    assert.deepEqual(rows[0].stages, { awakeMin: 30, lightMin: 240, deepMin: 90, remMin: 120 });
    assert.equal(rows[0].asleepMin, 450);
    assert.equal(rows[0].asleepIsEstimate, false);
  });
  it('Schlaf mit unlesbaren Phasen: keine Phasen erfunden', () => {
    const { rows, warnings } = mapSleep([night('2026-10-23T23:00', '2026-10-24T07:00', { stages: [{ type: 'MYSTERY', foo: 1 }] })]);
    assert.equal(rows[0].stages, undefined);
    assert.ok(warnings.some((w) => w.includes('Phasen')));
  });
  it('Nickerchen werden zugunsten der Hauptnacht ignoriert', () => {
    const { rows } = mapSleep([night('2026-10-24T13:00', '2026-10-24T13:40'), night('2026-10-23T23:00', '2026-10-24T07:00')]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].inBedMin, 480);
  });
  it('Training: Dauer, Typ-Übersetzung', () => {
    const { rows } = mapExercises([{ name: 'e1', exercise: { exerciseType: 'RUNNING', interval: { startTime: '2026-10-24T05:00:00Z', endTime: '2026-10-24T05:45:00Z', civilStartTime: { year: 2026, month: 10, day: 24, hours: 7, minutes: 0 } } } }]);
    assert.equal(rows[0].type, 'Laufen');
    assert.equal(rows[0].durationMin, 45);
    assert.equal(rows[0].startLocal, '2026-10-24T07:00:00');
  });
  it('Herzfrequenz → Minutenmittel → Zonen; identisch zur App-Berechnung (Parität)', () => {
    const pts = Array.from({ length: 180 }, (_, i) => ({ heartRate: { beatsPerMinute: String(100 + (i % 90)), sampleTime: { physicalTime: new Date(Date.UTC(2026, 9, 24, 5, 0, i)).toISOString() } } }));
    const perMin = heartRatePerMinute(pts);
    assert.equal(perMin.length, 3);
    const rnd = (n: number) => Array.from({ length: n }, (_, i) => 95 + ((i * 37) % 100));
    const sample = rnd(500);
    assert.deepEqual(zoneMinutesFromHr(sample, 188, 52), coreZones(sample, 188, 52));
    assert.deepEqual(zoneMinutesFromHr(sample, 150, 140), coreZones(sample, 150, 140));
  });
});

describe('Sync-Orchestrierung', () => {
  const dp = (field: string, body: unknown) => ({ name: `x/${field}`, [field]: body });
  const route = (handlers: Record<string, () => Response>): FetchLike => async (u) => {
    const type = /dataTypes\/([^/]+)\/dataPoints/.exec(u)?.[1] ?? '';
    return (handlers[type] ?? (() => json({ dataPoints: [] })))();
  };
  const base = { from: '2026-10-20', to: '2026-10-24', grantedScopes: [...REQUIRED_SCOPES] };

  it('trennt echte Daten, keine Daten, fehlende Berechtigung und nicht unterstütztes Gerät', async () => {
    const f = route({
      'daily-resting-heart-rate': () => json({ dataPoints: [dp('dailyRestingHeartRate', { date: { year: 2026, month: 10, day: 24 }, beatsPerMinute: '51' })] }),
      'daily-heart-rate-variability': () => json({ error: { status: 'PERMISSION_DENIED', message: 'no' } }, 403),
    });
    const client = new GoogleHealthClient('AT', { fetchFn: f, sleep: noSleep });
    const out = await runSync({ ...base, client, deviceTypes: new Set([...FITBIT_AIR_DATA_TYPES].filter((t) => t !== 'daily-vo2-max')) });
    assert.equal(out.status['daily-resting-heart-rate'].state, 'ok');
    assert.equal(out.status['daily-heart-rate-variability'].state, 'missing_scope');
    assert.equal(out.status['daily-respiratory-rate'].state, 'no_data');
    assert.equal(out.status['daily-vo2-max'].state, 'unsupported_device');
    assert.deepEqual(out.daily, [{ date: '2026-10-24', restingHr: 51 }]);
    assert.equal(out.rateLimited, false);
  });
  it('fehlende Scopes werden gar nicht erst angefragt', async () => {
    const requested: string[] = [];
    const f: FetchLike = async (u) => (requested.push(/dataTypes\/([^/]+)\//.exec(u)![1]), json({ dataPoints: [] }));
    const client = new GoogleHealthClient('AT', { fetchFn: f, sleep: noSleep });
    const out = await runSync({ ...base, grantedScopes: [SCOPES.sleep], client });
    assert.deepEqual([...new Set(requested)], ['sleep']);
    assert.equal(out.status['steps'].state, 'missing_scope');
    assert.equal(out.status['sleep'].state, 'no_data');
  });
  it('Rate-Limit beendet den Lauf kontrolliert, bereits geladene Daten bleiben erhalten', async () => {
    let n = 0;
    const f: FetchLike = async (u) => {
      if (/daily-resting-heart-rate/.test(u)) return json({ dataPoints: [dp('dailyRestingHeartRate', { date: { year: 2026, month: 10, day: 24 }, beatsPerMinute: '50' })] });
      n++;
      return json({}, 429);
    };
    const client = new GoogleHealthClient('AT', { fetchFn: f, sleep: noSleep, maxRetries: 1 });
    const out = await runSync({ ...base, client });
    assert.equal(out.rateLimited, true);
    assert.equal(out.daily.length, 1);
    assert.equal(out.status['daily-heart-rate-variability'].state, 'error');
    assert.match(out.status['daily-heart-rate-variability'].message ?? '', /Rate-Limit/);
    assert.equal(n, 2, 'nach dem ersten 429-Abbruch (inkl. 1 Retry) keine weiteren Datentypen');
  });
  it('Intervalltypen werden in Blöcken abgefragt (7 Tage) und die Summen je Tag gebildet', async () => {
    const stepsCalls: string[] = [];
    const f: FetchLike = async (u) => {
      if (/dataTypes\/steps\//.test(u)) {
        stepsCalls.push(new URL(u).searchParams.get('filter')!);
        return json({ dataPoints: [dp('steps', { count: '100', interval: { startTime: '2026-10-01T10:00:00Z', endTime: '2026-10-01T10:01:00Z', civilStartTime: { year: 2026, month: 10, day: 1, hours: 12, minutes: 0 } } })] });
      }
      return json({ dataPoints: [] });
    };
    const client = new GoogleHealthClient('AT', { fetchFn: f, sleep: noSleep });
    const out = await runSync({ ...base, from: '2026-10-01', to: '2026-10-20', client });
    assert.equal(stepsCalls.length, 3, '20 Tage → 3 Blöcke à ≤ 7 Tage');
    assert.equal(out.daily.find((d) => d.date === '2026-10-01')!.steps, 300);
  });
  it('addDays ist kalenderbasiert', () => {
    assert.equal(addDays('2026-10-25', 1), '2026-10-26');
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  });
  it('Zonen für Trainings werden berechnet, wenn Ruhepuls und HRmax bekannt sind', async () => {
    const hr = Array.from({ length: 40 }, (_, i) => ({ heartRate: { beatsPerMinute: '150', sampleTime: { physicalTime: new Date(Date.UTC(2026, 9, 24, 5, i)).toISOString() } } }));
    const f = route({
      'daily-resting-heart-rate': () => json({ dataPoints: [dp('dailyRestingHeartRate', { date: { year: 2026, month: 10, day: 24 }, beatsPerMinute: '50' })] }),
      exercise: () => json({ dataPoints: [{ name: 'e1', exercise: { exerciseType: 'RUNNING', interval: { startTime: '2026-10-24T05:00:00Z', endTime: '2026-10-24T05:40:00Z', civilStartTime: { year: 2026, month: 10, day: 24, hours: 7, minutes: 0 } } } }] }),
      'heart-rate': () => json({ dataPoints: hr }),
    });
    const client = new GoogleHealthClient('AT', { fetchFn: f, sleep: noSleep });
    const out = await runSync({ ...base, client, hrMax: 190 });
    // HRR = 140; 150 bpm → (150−50)/140 = 71 % → Zone 3
    assert.deepEqual(out.workouts[0].zoneMinutes, [0, 0, 40, 0, 0]);
  });
});

describe('Katalog', () => {
  it('Fitbit-Air-Liste enthält die dokumentierten Kerntypen', () => {
    for (const t of ['sleep', 'steps', 'heart-rate', 'daily-resting-heart-rate', 'daily-heart-rate-variability', 'active-zone-minutes', 'daily-vo2-max', 'daily-sleep-temperature-derivations']) {
      assert.ok(FITBIT_AIR_DATA_TYPES.has(t), t);
    }
  });
  it('initialStatus: ohne Scope → missing_scope, nicht unterstützt → unsupported_device', () => {
    const s = initialStatus([SCOPES.metrics], new Set(['steps', 'daily-resting-heart-rate']));
    assert.equal(s['daily-resting-heart-rate'].state, 'not_requested');
    assert.equal(s['steps'].state, 'missing_scope');
    assert.equal(s['sleep'].state, 'unsupported_device');
  });
});

describe('Konsistenz App ↔ Server', () => {
  it('Bildanalyse-Prompt ist identisch', () => assert.equal(SERVER_PROMPT, APP_PROMPT));
  it('Edge Functions nutzen nur Tabellen/Einwilligungen, die die Migrationen anlegen', () => {
    const sql = readFileSync(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8');
    for (const t of ['meals', 'meal_items', 'wearable_secrets', 'ai_insights', 'daily_metrics', 'sleep_sessions', 'workouts']) assert.match(sql, new RegExp(`create table public\\.${t}\\b`), t);
    for (const p of ['ai_food_analysis', 'ai_coach', 'google_health_import']) assert.match(sql, new RegExp(`'${p}'`), p);
    assert.doesNotMatch(sql, /create policy[^;]*wearable_secrets/, 'wearable_secrets darf keine Client-Policy haben');
  });
  it('kein Geheimnis im Quellcode', () => {
    for (const f of ['../supabase/functions/food-analyze/index.ts', '../supabase/functions/coach/index.ts', '../supabase/functions/_shared/tokens.ts']) {
      assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /sk-ant-|AIza|GOCSPX-/);
    }
  });
});
