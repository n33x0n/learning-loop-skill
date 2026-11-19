import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'learning-loop', 'scripts', 'review.mjs');

function unit(over = {}) {
  return { file: 'knowledge/u.md', level: 0, lastReview: null, nextReview: '2025-01-01', lastResult: null, evidence: null, ...over };
}

function setup(units) {
  const dir = mkdtempSync(join(tmpdir(), 'learning-loop-'));
  const state = join(dir, 'progress.json');
  writeFileSync(state, JSON.stringify({ units }));
  writeFileSync(join(dir, 'evidence.md'), 'evidence\n');
  return { dir, state };
}

function run(args, { cwd, env } = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd, encoding: 'utf8', env: { ...process.env, LEARNING_LOOP_TZ: '', ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function withDir(units, fn) {
  const ctx = setup(units);
  try { return fn(ctx); } finally { rmSync(ctx.dir, { recursive: true, force: true }); }
}

function record(ctx, id, result, on, extra = []) {
  return run(['record', id, result, '--evidence', join(ctx.dir, 'evidence.md'), '--on', on, '--state', ctx.state, ...extra]);
}

test('due filters and sorts by date, level, id', () => {
  withDir({
    c: unit({ nextReview: '2025-01-02', level: 1 }),
    b: unit({ nextReview: '2025-01-01', level: 2 }),
    a: unit({ nextReview: '2025-01-01', level: 2 }),
    z: unit({ nextReview: '2025-01-01', level: 0 }),
    later: unit({ nextReview: '2025-02-01' }),
  }, ({ state }) => {
    const r = run(['due', '--on', '2025-01-02', '--state', state]);
    assert.equal(r.code, 0);
    const parsed = JSON.parse(r.out);
    assert.equal(parsed.asOf, '2025-01-02');
    assert.deepEqual(parsed.due.map((u) => u.id), ['z', 'a', 'b', 'c']);
  });
});

test('pass advances through all intervals then stays at the top', () => {
  withDir({ u: unit() }, (ctx) => {
    let day = '2025-01-01';
    const expected = [['2025-01-02', 1], ['2025-01-05', 2], ['2025-01-12', 3], ['2025-01-26', 4], ['2025-02-09', 4]];
    for (const [next, level] of expected) {
      const r = record(ctx, 'u', 'pass', day);
      assert.equal(r.code, 0, r.err);
      const out = JSON.parse(r.out);
      assert.equal(out.nextReview, next);
      assert.equal(out.level, level);
      assert.equal(out.lastResult, 'pass');
      day = next;
    }
  });
});

test('early pass is rejected', () => {
  withDir({ u: unit({ nextReview: '2025-01-10', lastReview: '2025-01-07', level: 1 }) }, (ctx) => {
    const r = record(ctx, 'u', 'pass', '2025-01-08');
    assert.notEqual(r.code, 0);
    assert.match(r.err, /Not due yet/);
  });
});

test('second pass on the same day is rejected', () => {
  withDir({ u: unit() }, (ctx) => {
    assert.equal(record(ctx, 'u', 'pass', '2025-01-01').code, 0);
    const r = record(ctx, 'u', 'pass', '2025-01-01');
    assert.notEqual(r.code, 0);
    assert.match(r.err, /Already reviewed today|Not due yet/);
    const state = JSON.parse(readFileSync(ctx.state, 'utf8'));
    assert.equal(state.units.u.level, 1);
  });
});

test('partial and fail reset to level 0 due the next day', () => {
  for (const result of ['partial', 'fail']) {
    withDir({ u: unit({ level: 3, lastReview: '2025-01-01', nextReview: '2025-01-08' }) }, (ctx) => {
      const r = record(ctx, 'u', result, '2025-01-08');
      assert.equal(r.code, 0, r.err);
      const out = JSON.parse(r.out);
      assert.equal(out.level, 0);
      assert.equal(out.nextReview, '2025-01-09');
      assert.equal(out.lastResult, result);
    });
  }
});

test('errors exit non-zero with a clear message', () => {
  withDir({ u: unit() }, (ctx) => {
    const cases = [
      [['record', 'nope', 'pass', '--evidence', join(ctx.dir, 'evidence.md'), '--on', '2025-01-01', '--state', ctx.state], /Unknown review unit/],
      [['record', 'u', 'great', '--evidence', join(ctx.dir, 'evidence.md'), '--on', '2025-01-01', '--state', ctx.state], /Expected pass, partial or fail/],
      [['record', 'u', 'pass', '--on', '2025-01-01', '--state', ctx.state], /evidence file is required/],
      [['record', 'u', 'pass', '--evidence', join(ctx.dir, 'missing.md'), '--on', '2025-01-01', '--state', ctx.state], /Evidence file not found/],
      [['due', '--on', '2025-02-30', '--state', ctx.state], /Invalid calendar date/],
      [['due', '--on', 'yesterday', '--state', ctx.state], /Expected YYYY-MM-DD/],
      [['due', '--state', join(ctx.dir, 'absent.json')], /Cannot read review state/],
      [['frobnicate', '--state', ctx.state], /Unknown command/],
    ];
    for (const [args, pattern] of cases) {
      const r = run(args);
      assert.notEqual(r.code, 0, args.join(' '));
      assert.match(r.err, pattern, args.join(' '));
    }
  });
});

test('corrupt or invalid state exits non-zero', () => {
  withDir({ u: unit() }, (ctx) => {
    const bad = ['{not json', '{}', JSON.stringify({ units: { u: unit({ level: 9 }) } }), JSON.stringify({ units: { u: unit({ nextReview: 'soon' }) } })];
    for (const text of bad) {
      writeFileSync(ctx.state, text);
      const r = run(['due', '--on', '2025-01-01', '--state', ctx.state]);
      assert.notEqual(r.code, 0, text);
      assert.ok(r.err.trim().length > 0, text);
    }
  });
});

test('timezone option changes today; invalid zone is rejected', () => {
  withDir({ u: unit() }, ({ state }) => {
    const utc = JSON.parse(run(['due', '--state', state, '--timezone', 'UTC']).out).asOf;
    const kiritimati = JSON.parse(run(['due', '--state', state, '--timezone', 'Pacific/Kiritimati']).out).asOf;
    const niue = JSON.parse(run(['due', '--state', state, '--timezone', 'Pacific/Niue']).out).asOf;
    assert.match(utc, /^\d{4}-\d{2}-\d{2}$/);
    assert.notEqual(kiritimati, niue); // UTC+14 and UTC-11 are always on different days
    const env = JSON.parse(run(['due', '--state', state], { env: { LEARNING_LOOP_TZ: 'Pacific/Kiritimati' } }).out).asOf;
    assert.equal(env, kiritimati);
    const bad = run(['due', '--state', state, '--timezone', 'Mars/Olympus']);
    assert.notEqual(bad.code, 0);
    assert.match(bad.err, /Unknown time zone: Mars\/Olympus/);
  });
});

test('default state is ./knowledge/progress.json and relative evidence uses the working directory', () => {
  withDir({ u: unit() }, ({ dir }) => {
    mkdirSync(join(dir, 'knowledge', 'reviews'), { recursive: true });
    writeFileSync(join(dir, 'knowledge', 'progress.json'), JSON.stringify({ units: { u: unit() } }));
    writeFileSync(join(dir, 'knowledge', 'reviews', 'r.md'), 'r\n');
    const r = run(['record', 'u', 'pass', '--evidence', 'knowledge/reviews/r.md', '--on', '2025-01-01'], { cwd: dir });
    assert.equal(r.code, 0, r.err);
    const state = JSON.parse(readFileSync(join(dir, 'knowledge', 'progress.json'), 'utf8'));
    assert.equal(state.units.u.evidence, 'knowledge/reviews/r.md');
    assert.equal(state.units.u.level, 1);
  });
});

test('record leaves no temporary file behind', () => {
  withDir({ u: unit() }, (ctx) => {
    assert.equal(record(ctx, 'u', 'pass', '2025-01-01').code, 0);
    assert.deepEqual(readdirSync(ctx.dir).sort(), ['evidence.md', 'progress.json']);
  });
});
