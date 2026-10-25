import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REGION_SHAPES, bodyShapes, heat, mirrorPath, viewsOf } from '../src/core/bodyMap.ts';
import { EXERCISES, REGIONS } from '../src/core/exercises.ts';

const NUM = /-?\d+(?:\.\d+)?/g;

describe('Körperfigur', () => {
  it('Spiegelung ist an x = 100 und selbstinvers', () => {
    assert.equal(mirrorPath('M 60 10 L 80.5 20 Z'), 'M 140 10 L 119.5 20 Z');
    const d = 'M 41 104 C 38 116 36 128 35.6 130 L 46 130 Z';
    assert.equal(mirrorPath(mirrorPath(d)), d);
  });
  it('Pfade sind wohlgeformt: nur M/L/C/Z, Koordinaten im Bereich, korrekte Zahl je Befehl', () => {
    const counts: Record<string, number> = { M: 2, L: 2, C: 6, Z: 0 };
    for (const v of ['front', 'back'] as const) {
      const s = bodyShapes(v);
      for (const d of [...s.base, ...s.regions.map((r) => r.d)]) {
        assert.match(d, /^[MLCZ0-9.\s-]+$/, d);
        for (const seg of d.split(/(?=[MLCZ])/).map((x) => x.trim()).filter(Boolean)) {
          const cmd = seg[0];
          assert.ok(cmd in counts, `${cmd} in ${d}`);
          const nums = seg.slice(1).match(NUM) ?? [];
          assert.equal(nums.length, counts[cmd], `${seg}`);
          for (const n of nums) assert.ok(Number(n) >= 0 && Number(n) <= 380, seg);
        }
      }
    }
  });
  it('jede Region ist in mindestens einer Ansicht sichtbar, beidseitig vorhanden', () => {
    for (const r of REGIONS) assert.ok(viewsOf(r).length >= 1, `Region ${r} ohne Form`);
    for (const v of ['front', 'back'] as const) {
      const s = bodyShapes(v);
      assert.equal(s.regions.length, REGION_SHAPES[v].length * 2);
    }
  });
  it('jede Region, die eine Übung trifft, ist auf der Figur sichtbar', () => {
    for (const e of EXERCISES) for (const r of Object.keys(e.regions)) assert.ok(viewsOf(r as never).length >= 1, `${e.id}:${r}`);
  });
  it('Farbintensität', () => {
    assert.equal(heat(undefined), 0);
    assert.equal(heat(0), 0);
    assert.equal(heat(0.1, 8), 0.18);
    assert.equal(heat(4, 8), 0.5);
    assert.equal(heat(50, 8), 1);
  });
});
