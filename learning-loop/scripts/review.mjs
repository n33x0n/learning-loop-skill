#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, renameSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const intervals = [1, 3, 7, 14];
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    state: { type: 'string' },
    on: { type: 'string' },
    evidence: { type: 'string' },
    timezone: { type: 'string' },
    help: { type: 'boolean' },
  },
});

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Expected YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid calendar date');
  }
  return value;
}

function addDays(day, count) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function dayFormatter(timeZone) {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    throw new Error(`Unknown time zone: ${timeZone}`);
  }
}

function loadState(statePath) {
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read review state ${statePath}: ${error.message}`);
  }
  if (!state || !state.units || Array.isArray(state.units) || typeof state.units !== 'object') {
    throw new Error('Missing units in review state');
  }
  for (const unit of Object.values(state.units)) {
    if (!unit || typeof unit !== 'object') throw new Error('Invalid unit in review state');
    if (!Number.isInteger(unit.level) || unit.level < 0 || unit.level > intervals.length) {
      throw new Error('Invalid review level');
    }
    dateOnly(unit.nextReview);
    if (unit.lastReview !== null) dateOnly(unit.lastReview);
  }
  return state;
}

try {
  const [command, id, result] = positionals;
  if (values.help || command === 'help' || !command) {
    console.log([
      'Usage: review.mjs due [--on YYYY-MM-DD] [--state file] [--timezone ZONE]',
      '       review.mjs record UNIT pass|partial|fail --evidence file [--on YYYY-MM-DD] [--state file] [--timezone ZONE]',
      'State defaults to ./knowledge/progress.json in the current directory.',
      'Dates default to today in the time zone from --timezone or LEARNING_LOOP_TZ (default UTC).',
      'This command schedules reviews; it does not grade answers.',
    ].join('\n'));
  } else {
    const timeZone = values.timezone ?? (process.env.LEARNING_LOOP_TZ || 'UTC');
    const formatter = dayFormatter(timeZone);
    const today = dateOnly(values.on ?? formatter.format(new Date()));
    const statePath = resolve(values.state ?? 'knowledge/progress.json');
    const state = loadState(statePath);
    if (command === 'due') {
      if (positionals.length !== 1) throw new Error('due takes no positional arguments');
      const due = Object.entries(state.units)
        .filter(([, unit]) => unit.nextReview <= today)
        .map(([id, unit]) => ({ id, ...unit }))
        .sort((a, b) => a.nextReview.localeCompare(b.nextReview) || a.level - b.level || a.id.localeCompare(b.id));
      console.log(JSON.stringify({ asOf: today, due }, null, 2));
    } else if (command === 'record') {
      if (positionals.length !== 3 || !Object.hasOwn(state.units, id)) throw new Error('Unknown review unit');
      if (!['pass', 'partial', 'fail'].includes(result)) throw new Error('Expected pass, partial or fail');
      if (!values.evidence) throw new Error('An evidence file is required');
      const evidencePath = resolve(values.evidence);
      let isFile = false;
      try {
        isFile = statSync(evidencePath).isFile();
      } catch {
        throw new Error(`Evidence file not found: ${evidencePath}`);
      }
      if (!isFile) throw new Error('Evidence must be a file');
      const unit = state.units[id];
      if (unit.lastReview !== null && unit.lastReview > today) {
        throw new Error('A review cannot precede the last recorded review');
      }
      if (result === 'pass' && unit.lastReview === today) {
        throw new Error('Already reviewed today; corrections do not advance the schedule');
      }
      if (result === 'pass' && unit.nextReview > today) {
        throw new Error('Not due yet; an early pass does not advance the schedule');
      }
      const delay = result === 'pass' ? intervals[Math.min(unit.level, intervals.length - 1)] : 1;
      unit.level = result === 'pass' ? Math.min(unit.level + 1, intervals.length) : 0;
      unit.lastReview = today;
      unit.nextReview = addDays(today, delay);
      unit.lastResult = result;
      unit.evidence = isAbsolute(values.evidence) ? values.evidence : values.evidence.replaceAll('\\', '/');
      const temporary = `${statePath}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
      renameSync(temporary, statePath);
      console.log(JSON.stringify({ id, ...unit }, null, 2));
    } else {
      throw new Error('Unknown command');
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
