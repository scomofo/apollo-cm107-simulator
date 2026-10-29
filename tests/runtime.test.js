import test from 'node:test';
import assert from 'node:assert/strict';
import { ApolloRuntime, CHECKPOINT_SCHEMA, CHECKPOINT_VERSION } from '../src/runtime.js';
import { PARAMETERS, SOURCES, PARAMETER_DATA_VERSION } from '../src/parameters.js';
import { CHECKLISTS } from '../src/checklists.js';

function advance(runtime, steps) {
  for (let i = 0; i < steps; i += 1) runtime.advance(1 / 60);
}

function comparableTruth(runtime) {
  return { ...runtime.captureTruth(), paused: true };
}

test('recorded commands reproduce the exact truth state during replay', () => {
  const runtime = new ApolloRuntime();
  runtime.command('setPhase', { phase: 'launch' });
  advance(runtime, 120);
  runtime.command('rcs');
  advance(runtime, 180);
  runtime.command('view', { view: 'xray' });
  runtime.command('rate', { value: 2 });
  advance(runtime, 60);
  const expected = comparableTruth(runtime);

  assert.equal(runtime.startReplay(), true);
  let guard = 0;
  while (runtime.replaying && guard < 1000) {
    advance(runtime, 1);
    guard += 1;
  }
  assert.ok(guard < 1000, 'replay must terminate');
  assert.deepEqual(runtime.captureTruth(), expected);
  assert.equal(runtime.state.rcsPulseCount, 1);
});

test('checkpoint restore preserves truth, command log, and state object identity', () => {
  const runtime = new ApolloRuntime();
  const stateReference = runtime.state;
  runtime.command('setPhase', { phase: 'entry' });
  runtime.command('checklistNext');
  advance(runtime, 240);
  runtime.command('rcs');
  const snapshot = runtime.snapshot();
  const expected = runtime.captureTruth();

  runtime.command('setPhase', { phase: 'splash' });
  advance(runtime, 60);
  runtime.restore(snapshot);

  assert.equal(runtime.state, stateReference);
  assert.deepEqual(runtime.captureTruth(), expected);
  assert.deepEqual(runtime.events, snapshot.events);
  assert.equal(runtime.origin.tick, 0);
  assert.equal(runtime.startReplay(), true);
  let guard = 0;
  while (runtime.replaying && guard < 1000) {
    advance(runtime, 1);
    guard += 1;
  }
  assert.ok(guard < 1000, 'restored replay must terminate');
  assert.deepEqual(runtime.captureTruth(), { ...expected, paused: true });
});

test('checkpoint validation rejects incompatible or malformed data', () => {
  const runtime = new ApolloRuntime();
  assert.throws(() => runtime.restore(null), /Unsupported checkpoint/);
  assert.throws(() => runtime.restore({ schema: CHECKPOINT_SCHEMA, version: 999 }), /Unsupported checkpoint/);
  assert.throws(() => runtime.restore({
    schema: CHECKPOINT_SCHEMA,
    version: CHECKPOINT_VERSION,
    mission: 'other-mission',
    parameterDataVersion: PARAMETER_DATA_VERSION,
    truth: { phase: 'coast' },
    origin: {},
    events: [],
  }), /mission or parameter data version/);
});

test('checklist notes require continuation and observable actions advance once', () => {
  const runtime = new ApolloRuntime();
  assert.equal(runtime.state.checklist.index, 0);
  runtime.command('checklistAdvance', { step: 'return-intro' });
  assert.equal(runtime.state.checklist.index, 0, 'notes cannot auto-advance');

  runtime.command('checklistNext');
  assert.equal(runtime.state.checklist.index, 1);
  runtime.command('checklistAdvance', { step: 'select-coast' });
  runtime.command('checklistAdvance', { step: 'select-coast' });
  assert.equal(runtime.state.checklist.index, 2);
  assert.deepEqual(runtime.state.checklist.completed, ['return-intro', 'select-coast']);

  runtime.command('rcs');
  runtime.command('checklistAdvance', { step: 'fire-rcs' });
  assert.equal(runtime.state.checklist.index, 3);
});

test('parameter registry has valid confidence and source metadata', () => {
  const allowed = new Set(['sourced', 'derived', 'estimated']);
  for (const [id, entry] of Object.entries(PARAMETERS)) {
    assert.ok(allowed.has(entry.confidence), `${id} confidence`);
    assert.ok(SOURCES[entry.source], `${id} source must exist`);
    assert.ok(Number.isFinite(entry.value), `${id} value`);
    assert.ok(entry.unit && entry.note && entry.label, `${id} display metadata`);
  }
});

test('every observable checklist step has a condition and valid target when needed', () => {
  for (const guide of Object.values(CHECKLISTS)) {
    assert.ok(guide.steps.length > 0);
    for (const step of guide.steps) {
      if (step.kind === 'note') continue;
      assert.equal(typeof step.when, 'function', `${step.id} condition`);
      assert.ok(step.target, `${step.id} target`);
      assert.equal(typeof step.when(new ApolloRuntime().state), 'boolean');
    }
  }
});
