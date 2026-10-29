import { parameter, PARAMETER_DATA_VERSION } from './parameters.js';
import { CHECKLISTS, checklistStep } from './checklists.js';

export const CHECKPOINT_SCHEMA = 'apollo-cm107-checkpoint';
export const CHECKPOINT_VERSION = 1;
export const RUNTIME_STEP = 1 / 60;
export const PHASE_ORDER = ['launch', 'coast', 'entry', 'drogue', 'mains', 'splash'];

const INITIAL_STATE = {
  phase: 'coast',
  phaseTime: 0,
  paused: false,
  playbackRate: 1,
  rcsRemaining: 0,
  rcsPulseCount: 0,
  view: 'exterior',
  checklist: { guide: 'return', index: 0, completed: [] },
};

const clone = (value) => structuredClone(value);

export class ApolloRuntime {
  constructor() {
    this.state = clone(INITIAL_STATE);
    this.tick = 0;
    this.eventSeq = 0;
    this.accumulator = 0;
    this.events = [];
    this.origin = this.captureTruth();
    this.replaying = null;
  }

  captureTruth() {
    return { ...clone(this.state), tick: this.tick };
  }

  assignTruth(truth) {
    // Keep the state object's identity stable: the renderer holds a reference,
    // but it can never advance or mutate simulation truth itself.
    Object.assign(this.state, clone(truth));
    this.tick = truth.tick;
    this.accumulator = 0;
  }

  apply(type, payload = {}) {
    const s = this.state;
    if (type === 'setPhase' && PHASE_ORDER.includes(payload.phase)) {
      s.phase = payload.phase;
      s.phaseTime = 0;
      s.rcsRemaining = 0;
    } else if (type === 'setPaused') {
      s.paused = Boolean(payload.value);
    } else if (type === 'rate' && [0.5, 1, 2, 4].includes(Number(payload.value))) {
      s.playbackRate = Number(payload.value);
    } else if (type === 'seek') {
      const value = Number(payload.time);
      s.phaseTime = Number.isFinite(value) ? Math.max(0, Math.min(parameter('presentation.phaseDuration'), value)) : 0;
      s.paused = true;
      s.rcsRemaining = 0;
    } else if (type === 'restart') {
      s.phaseTime = 0;
      s.rcsRemaining = 0;
    } else if (type === 'rcs') {
      if (s.phase !== 'coast' && s.phase !== 'entry') {
        s.phase = 'coast';
        s.phaseTime = 0;
      }
      s.rcsRemaining = parameter('rcs.pulseDuration');
      s.rcsPulseCount += 1;
    } else if (type === 'view' && ['exterior', 'xray', 'systems'].includes(payload.view)) {
      s.view = payload.view;
    } else if (type === 'checklistGuide' && CHECKLISTS[payload.guide]) {
      s.checklist = { guide: payload.guide, index: 0, completed: [] };
    } else if (type === 'checklistNext') {
      const step = checklistStep(s);
      if (step?.kind === 'note') {
        s.checklist.completed.push(step.id);
        s.checklist.index += 1;
      }
    } else if (type === 'checklistAdvance') {
      const step = checklistStep(s);
      if (step && step.kind !== 'note' && step.id === payload.step) {
        s.checklist.completed.push(step.id);
        s.checklist.index += 1;
      }
    }
  }

  command(type, payload = {}, record = true) {
    if (this.replaying && record) return false;
    this.apply(type, payload);
    if (record) this.events.push({ tick: this.tick, seq: this.eventSeq++, type, payload: clone(payload) });
    return true;
  }

  integrate(dt) {
    const s = this.state;
    s.phaseTime += dt;
    s.rcsRemaining = Math.max(0, s.rcsRemaining - dt);
    const duration = parameter('presentation.phaseDuration');
    if (s.phaseTime >= duration) {
      const index = PHASE_ORDER.indexOf(s.phase);
      if (s.phase !== 'splash' && index < PHASE_ORDER.length - 1) {
        s.phase = PHASE_ORDER[index + 1];
        s.phaseTime = 0;
        s.rcsRemaining = 0;
      } else {
        s.phaseTime %= duration;
      }
    }
  }

  advance(realDt) {
    if (this.state.paused || !Number.isFinite(realDt) || realDt <= 0) return;
    this.accumulator += realDt * this.state.playbackRate;
    while (this.accumulator >= RUNTIME_STEP) {
      this.accumulator -= RUNTIME_STEP;
      this.tick += 1;
      // Commands are recorded between fixed steps. An event recorded at tick N
      // therefore affects the following step, except tick-0 events applied at
      // replay initialization.
      if (this.replaying) this.applyReplayEvents(this.tick - 1);
      this.integrate(RUNTIME_STEP);
      if (this.replaying && this.tick >= this.replaying.targetTick) {
        // Commands recorded at the target tick happened after that tick's
        // integration. Apply them without advancing time a second time.
        this.applyReplayEvents(this.tick);
        this.finishReplay();
        break;
      }
    }
  }

  applyReplayEvents(tick) {
    if (!this.replaying) return;
    while (this.replaying.index < this.replaying.events.length) {
      const event = this.replaying.events[this.replaying.index];
      if (event.tick > tick) break;
      if (event.tick === tick) this.apply(event.type, event.payload);
      this.replaying.index += 1;
    }
  }

  startReplay() {
    if (this.replaying || (this.tick === 0 && this.events.length === 0)) return false;
    const replay = {
      origin: clone(this.origin),
      events: clone(this.events),
      targetTick: this.tick,
      index: 0,
    };
    this.assignTruth(replay.origin);
    this.replaying = replay;
    this.applyReplayEvents(replay.origin.tick);
    if (this.tick >= replay.targetTick) this.finishReplay();
    else this.state.paused = false;
    return true;
  }

  finishReplay() {
    this.replaying = null;
    this.state.paused = true;
    this.accumulator = 0;
  }

  snapshot() {
    return {
      schema: CHECKPOINT_SCHEMA,
      version: CHECKPOINT_VERSION,
      mission: 'apollo-11-return',
      parameterDataVersion: PARAMETER_DATA_VERSION,
      truth: this.captureTruth(),
      origin: clone(this.origin),
      events: clone(this.events),
      eventSeq: this.eventSeq,
    };
  }

  restore(snapshot) {
    if (!snapshot || snapshot.schema !== CHECKPOINT_SCHEMA || snapshot.version !== CHECKPOINT_VERSION) {
      throw new Error('Unsupported checkpoint schema or version');
    }
    if (snapshot.mission !== 'apollo-11-return' || snapshot.parameterDataVersion !== PARAMETER_DATA_VERSION) {
      throw new Error('Checkpoint mission or parameter data version does not match');
    }
    if (!PHASE_ORDER.includes(snapshot.truth?.phase) || !Array.isArray(snapshot.events) || !snapshot.origin) {
      throw new Error('Checkpoint is incomplete or malformed');
    }
    this.assignTruth(snapshot.truth);
    this.origin = clone(snapshot.origin);
    this.events = clone(snapshot.events);
    this.eventSeq = Number.isInteger(snapshot.eventSeq) ? snapshot.eventSeq : this.events.length;
    this.replaying = null;
  }
}
