import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KAPPA, SELF_SHAPES, holdsSelf, stewardWeight, stewardElectorate, outcome, decide } from './kernel.mjs';

// ── the constants are pinned numerically (a test deriving from the export would follow a mutated constant)
test('KAPPA is 1/phi and the self-shapes are verify + remember', () => {
  assert.equal(KAPPA, 0.618);
  assert.deepEqual([...SELF_SHAPES], ['verify', 'remember']);
});

// ── holdsSelf: a self needs BOTH scarce shapes at or above kappa
test('holdsSelf: both verify and remember at/above kappa holds a self', () => {
  assert.equal(holdsSelf({ verify: 0.7, remember: 0.7 }).holdsSelf, true);
});

test('holdsSelf RED LINE: missing EITHER scarce shape is no self (kills && -> ||)', () => {
  assert.equal(holdsSelf({ verify: 0.7, remember: 0.5 }).holdsSelf, false);   // || would wrongly say true
  assert.equal(holdsSelf({ verify: 0.5, remember: 0.7 }).holdsSelf, false);   // the other direction too
  assert.equal(holdsSelf({ verify: 0.5, remember: 0.5 }).holdsSelf, false);
});

test('holdsSelf: the kappa boundary is inclusive (kills >= vs >)', () => {
  assert.equal(holdsSelf({ verify: KAPPA, remember: KAPPA }).holdsSelf, true);   // exactly kappa is held
  assert.equal(holdsSelf({ verify: 0.617, remember: 0.7 }).holdsSelf, false);    // just under is not
  assert.equal(holdsSelf({ verify: 0.7, remember: 0.617 }).holdsSelf, false);
});

test('holdsSelf: total on garbage, endpoints valid', () => {
  assert.equal(holdsSelf(null).ok, false);
  assert.equal(holdsSelf('x').ok, false);
  assert.equal(holdsSelf({ verify: 1, remember: 1 }).ok, true);              // exactly 1 is a valid phase
  assert.equal(holdsSelf({ verify: 1, remember: 1 }).holdsSelf, true);
  assert.equal(holdsSelf({ verify: 1.5, remember: 0.7 }).ok, false);         // above one rejected (kills > 1 -> >= 1)
  assert.equal(holdsSelf({ verify: -0.1, remember: 0.7 }).ok, false);        // below zero rejected
  assert.equal(holdsSelf({ verify: NaN, remember: 0.7 }).ok, false);         // not-a-finite-number (kills isNum && -> ||)
  assert.equal(holdsSelf({ verify: 'x', remember: 0.7 }).ok, false);
  assert.equal(holdsSelf({ remember: 0.7 }).ok, false);                       // missing verify entirely
});

// ── stewardWeight: earned units become weight ONLY with a self
test('stewardWeight: a self-holder carries its full contribution', () => {
  const r = stewardWeight({ contribution: 20, phases: { verify: 0.7, remember: 0.7 } });
  assert.equal(r.weight, 20);
  assert.equal(r.eligible, true);
});

test('stewardWeight RED LINE: a fit cripple earns but carries ZERO weight (kills the ternary)', () => {
  const r = stewardWeight({ contribution: 100, phases: { verify: 0.3, remember: 0.3 } });
  assert.equal(r.weight, 0);
  assert.equal(r.eligible, false);
  assert.equal(r.contribution, 100);   // it KEEPS its units — only its steering weight is zero
  assert.ok(r.why.includes('cripple'));
});

test('stewardWeight: contribution must be a non-negative integer; zero is valid', () => {
  assert.equal(stewardWeight({ contribution: 0, phases: { verify: 0.7, remember: 0.7 } }).weight, 0);   // zero contribution, held self
  assert.equal(stewardWeight({ contribution: 0, phases: { verify: 0.7, remember: 0.7 } }).eligible, true);
  assert.equal(stewardWeight({ contribution: -1, phases: { verify: 0.7, remember: 0.7 } }).ok, false);  // negative refused
  assert.equal(stewardWeight({ contribution: 1.5, phases: { verify: 0.7, remember: 0.7 } }).ok, false); // non-integer refused
  assert.equal(stewardWeight(null).ok, false);
  assert.equal(stewardWeight({ contribution: 5, phases: { verify: NaN, remember: 0.7 } }).ok, false);   // propagates the phases error
});

// ── stewardElectorate: the drop-in electorate, cripples zeroed
test('stewardElectorate: cripples zeroed and listed as barred; stewards keep weight', () => {
  const r = stewardElectorate({
    whale: { contribution: 100, phases: { verify: 0.3, remember: 0.3 } },   // fit cripple
    s1: { contribution: 20, phases: { verify: 0.7, remember: 0.7 } },
    s2: { contribution: 20, phases: { verify: 0.7, remember: 0.7 } },
  });
  assert.deepEqual(r.electorate, { whale: 0, s1: 20, s2: 20 });
  assert.deepEqual(r.barred, ['whale']);
});

test('stewardElectorate: total on garbage and propagates a bad node', () => {
  assert.equal(stewardElectorate(null).ok, false);
  assert.equal(stewardElectorate([]).ok, false);   // an array is not the { nodeId: node } shape
  const r = stewardElectorate({ bad: { contribution: -1, phases: { verify: 0.7, remember: 0.7 } } });
  assert.equal(r.ok, false);
  assert.ok(r.why.includes('bad'));
});

// ── outcome: the contribution-weighted tally (integer-exact boundaries)
test('outcome: quorum boundary is inclusive (kills >= vs > and the * vs /)', () => {
  const e = { a: 1, b: 1 };   // total weight 2
  // only a votes -> voted weight 1 = exactly 50% of 2
  assert.equal(outcome(e, [{ nodeId: 'a', support: true }], { quorum: 50, passThreshold: 0 }).quorumMet, true);
  assert.equal(outcome(e, [{ nodeId: 'a', support: true }], { quorum: 51, passThreshold: 0 }).quorumMet, false);
});

test('outcome: pass threshold boundary is inclusive', () => {
  const e = { a: 1, b: 1 };
  const votes = [{ nodeId: 'a', support: true }, { nodeId: 'b', support: false }];   // voted 2, yes 1 = 50%
  assert.equal(outcome(e, votes, { quorum: 0, passThreshold: 50 }).passed, true);
  assert.equal(outcome(e, votes, { quorum: 0, passThreshold: 51 }).passed, false);
});

test('outcome: a non-member is ignored; a double vote is refused', () => {
  const e = { a: 5 };
  assert.equal(outcome(e, [{ nodeId: 'ghost', support: true }], { quorum: 0, passThreshold: 0 }).votedWeight, 0);
  assert.equal(outcome(e, [{ nodeId: 'a', support: true }, { nodeId: 'a', support: false }], { quorum: 0, passThreshold: 0 }).ok, false);
});

test('outcome: yes and no weights accumulate by the voter’s weight', () => {
  const e = { a: 3, b: 7 };
  const r = outcome(e, [{ nodeId: 'a', support: true }, { nodeId: 'b', support: false }], { quorum: 0, passThreshold: 0 });
  assert.equal(r.yesWeight, 3);
  assert.equal(r.noWeight, 7);
  assert.equal(r.votedWeight, 10);
});

test('outcome: total on garbage and guards its inputs', () => {
  assert.equal(outcome(null, [], { quorum: 0, passThreshold: 0 }).ok, false);
  assert.equal(outcome({ a: 1 }, 'x', { quorum: 0, passThreshold: 0 }).ok, false);
  assert.equal(outcome({ a: 1.5 }, [], { quorum: 0, passThreshold: 0 }).ok, false);   // non-integer weight
  assert.equal(outcome({ a: -1 }, [], { quorum: 0, passThreshold: 0 }).ok, false);    // negative weight
  assert.equal(outcome({ a: 0 }, [], { quorum: 0, passThreshold: 0 }).ok, true);      // zero weight is valid
  assert.equal(outcome({ a: 1 }, [{ nodeId: 'a' }], { quorum: 0, passThreshold: 0 }).ok, false);            // support missing
  assert.equal(outcome({ a: 1 }, [{ nodeId: 'a', support: 1 }], { quorum: 0, passThreshold: 0 }).ok, false); // support not boolean
  assert.equal(outcome({ a: 1 }, [], { quorum: 0 }).ok, false);                       // bylaws missing passThreshold
});

// ── decide: THE FOLD — the steward gate changes the outcome
test('decide RED LINE: a crippled whale passes on raw contribution but is defeated once self-gated', () => {
  const nodes = {
    whale: { contribution: 100, phases: { verify: 0.3, remember: 0.3 } },   // huge earner, no self
    s1: { contribution: 20, phases: { verify: 0.7, remember: 0.7 } },
    s2: { contribution: 20, phases: { verify: 0.7, remember: 0.7 } },
  };
  const votes = [
    { nodeId: 'whale', support: true },    // the whale wants it
    { nodeId: 's1', support: false },      // the stewards refuse
    { nodeId: 's2', support: false },
  ];
  const bylaws = { quorum: 50, passThreshold: 50 };
  const d = decide(nodes, votes, bylaws);
  assert.equal(d.raw.passed, true);        // blind to self, the whale rams it through
  assert.equal(d.steward.passed, false);   // self-gated, the whale carries zero weight and the stewards win
  assert.equal(d.flipped, true);           // the gate is load-bearing, not decorative
  assert.deepEqual(d.barred, ['whale']);
});

test('decide: with no cripple the two tallies agree (flipped is false)', () => {
  const nodes = {
    a: { contribution: 30, phases: { verify: 0.7, remember: 0.7 } },
    b: { contribution: 10, phases: { verify: 0.7, remember: 0.7 } },
  };
  const votes = [{ nodeId: 'a', support: true }, { nodeId: 'b', support: false }];
  const d = decide(nodes, votes, { quorum: 50, passThreshold: 50 });
  assert.equal(d.flipped, false);
  assert.equal(d.raw.passed, d.steward.passed);
  assert.deepEqual(d.barred, []);
});

test('decide: total on garbage', () => {
  assert.equal(decide(null, [], { quorum: 0, passThreshold: 0 }).ok, false);
  assert.equal(decide({ a: { contribution: -1, phases: { verify: 0.7, remember: 0.7 } } }, [], { quorum: 0, passThreshold: 0 }).ok, false);
});

// ── boundary probes that pin the guards (each kills a specific surviving mutant)
test('holdsSelf: a phase of exactly zero is VALID, just not held (kills < 0 -> <= 0)', () => {
  assert.equal(holdsSelf({ verify: 0, remember: 0.7 }).ok, true);
  assert.equal(holdsSelf({ verify: 0, remember: 0.7 }).holdsSelf, false);
  assert.equal(holdsSelf({ verify: 0.7, remember: 0 }).ok, true);
});

test('outcome: an empty or non-string nodeId is refused (kills isStr && -> || and > 0 -> >= 0, and line-100 first ||)', () => {
  assert.equal(outcome({ a: 1 }, [{ nodeId: '', support: true }], { quorum: 0, passThreshold: 0 }).ok, false);  // empty string is not a valid id
  assert.equal(outcome({ a: 1 }, [{ nodeId: 5, support: true }], { quorum: 0, passThreshold: 0 }).ok, false);   // a non-string id is refused
});

test('outcome: a present-but-invalid bylaw value is refused (kills line-90 first ||)', () => {
  assert.equal(outcome({ a: 1 }, [], { quorum: 'x', passThreshold: 50 }).ok, false);   // object bylaws, quorum not an integer
  assert.equal(outcome({ a: 1 }, [], { quorum: 50, passThreshold: 'x' }).ok, false);    // passThreshold not an integer
});
