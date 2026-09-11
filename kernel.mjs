// steward-gate — who may STEER the mesh's kernel. The recurse fold of build-geometry (§26 maturity) ⊕
// mesh-governance (§27 the unvotable kernel). mesh-governance weights a vote by CONTRIBUTION (units earned
// by verified work) — anti-Sybil, but blind to WHETHER a heavy contributor can hold a self. A node can grind
// BUILD and EXPLORE work, earn units, and never VERIFY or REMEMBER: a provably-fit CRIPPLE (build-geometry)
// that nonetheless accrues governance weight over a kernel it has no self to guard across time.
//
// THE FOLD: the two SCARCE self-persisting shapes are VERIFY (the octahedron — tell real from fake) and
// REMEMBER (the dodecahedron — hold the history). Those are exactly the two capacities that STEERING a kernel
// requires: a node that cannot verify cannot tell a real proposal from a forged one; a node that cannot
// remember re-litigates settled decisions and can be replayed. So a node's earned contribution becomes
// STEWARD WEIGHT only if it holds a self — verify AND remember, each at or above kappa. Otherwise it may
// still earn and keep its units, but it carries ZERO weight over the kernel. You may earn; you may only
// steer if you hold a self.
//
// Pure and total; guards one-per-line. Composes build-geometry (the scarce self-shapes + the kappa floor)
// and mesh-governance (the contribution-weighted tally). The electorate stewardElectorate returns is exactly
// the shape mesh-governance consumes, so this gate drops in FRONT of the existing governance unchanged.

export const KAPPA = 0.618;   // the self-shape floor (1/phi) — held at or above this counts (build-geometry)
// the two SCARCE shapes that persist a self (build-geometry SCARCE = octa + dodeca) — the two a steward needs
export const SELF_SHAPES = Object.freeze(['verify', 'remember']);

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isBool = (v) => typeof v === 'boolean';

/**
 * holdsSelf(phases) — does the node hold a self? phases carries verify and remember as numbers 0..1 (how well
 * the node holds each organ, on build-geometry's scale). A self is held only when BOTH scarce shapes are at
 * or above KAPPA. Missing EITHER one is no self to steer with — a provably-fit cripple may still hold the
 * other three organs (init/build/explore). Total on garbage.
 */
export function holdsSelf(phases) {
  if (!isObj(phases)) return { ok: false, why: 'phases reads { verify, remember }' };
  for (const shape of SELF_SHAPES) {
    if (!isNum(phases[shape])) return { ok: false, why: 'self-shape ' + shape + ' must be a number' };
    if (phases[shape] < 0 || phases[shape] > 1) return { ok: false, why: 'self-shape ' + shape + ' must be within zero to one' };
  }
  const verify = phases.verify >= KAPPA;
  const remember = phases.remember >= KAPPA;
  const holds = verify && remember;   // BOTH — a steward must tell real from fake AND hold the history
  return { ok: true, holdsSelf: holds, verify, remember };
}

/**
 * stewardWeight(node) — node = { contribution, phases }. contribution is the units earned by verified work (a
 * non-negative integer, mesh-governance's electorate value). The node's governance weight is its full
 * contribution IF it holds a self, else 0 — it keeps its units, it simply cannot steer the kernel.
 */
export function stewardWeight(node) {
  if (!isObj(node)) return { ok: false, why: 'node reads { contribution, phases }' };
  if (!isInt(node.contribution) || node.contribution < 0) return { ok: false, why: 'contribution must be a non-negative integer' };
  const h = holdsSelf(node.phases);
  if (!h.ok) return { ok: false, why: h.why };
  const weight = h.holdsSelf ? node.contribution : 0;
  return { ok: true, weight, eligible: h.holdsSelf, contribution: node.contribution,
    why: h.holdsSelf ? 'holds a self — may steer' : 'a provably-fit cripple: earns but cannot steer (missing verify and/or remember)' };
}

/**
 * stewardElectorate(nodes) — nodes = { nodeId: { contribution, phases } }. Returns { electorate, barred }:
 * electorate = { nodeId: weight } with cripples zeroed, exactly the shape mesh-governance's tally consumes;
 * barred lists the node ids that earn but may not steer. The steward gate drops in front of governance.
 */
export function stewardElectorate(nodes) {
  if (!isObj(nodes)) return { ok: false, why: 'nodes must be an object of nodeId to { contribution, phases }' };
  const electorate = {};
  const barred = [];
  for (const id of Object.keys(nodes)) {
    const w = stewardWeight(nodes[id]);
    if (!w.ok) return { ok: false, why: 'node ' + id + ': ' + w.why };
    electorate[id] = w.weight;
    if (!w.eligible) barred.push(id);
  }
  return { ok: true, electorate, barred };
}

/**
 * outcome(electorate, votes, bylaws) — the contribution-weighted decision (mesh-governance's tally, kept
 * self-contained so the page can run the whole fold). electorate = { nodeId: weight }; votes = [{ nodeId,
 * support }]; bylaws carry integer quorum and passThreshold percents. A voter not in the electorate is
 * ignored. Quorum: the voting weight is at least quorum percent of the total weight. Passed: the yes-weight
 * is at least passThreshold percent of the weight that voted. Integer-exact — no float boundaries.
 */
export function outcome(electorate, votes, bylaws) {
  if (!isObj(electorate)) return { ok: false, why: 'electorate is { nodeId: weight }' };
  if (!Array.isArray(votes)) return { ok: false, why: 'votes is an array of { nodeId, support }' };
  if (!isObj(bylaws) || !isInt(bylaws.quorum) || !isInt(bylaws.passThreshold)) return { ok: false, why: 'bylaws carry integer quorum and passThreshold percents' };
  let totalWeight = 0;
  for (const id of Object.keys(electorate)) {
    if (!isInt(electorate[id]) || electorate[id] < 0) return { ok: false, why: 'each weight must be a non-negative integer' };
    totalWeight += electorate[id];
  }
  const counted = new Set();
  let yesWeight = 0;
  let noWeight = 0;
  for (const v of votes) {
    if (!isObj(v) || !isStr(v.nodeId) || !isBool(v.support)) return { ok: false, why: 'each vote is { nodeId, support: boolean }' };
    if (!(v.nodeId in electorate)) continue;     // a non-member carries no weight
    if (counted.has(v.nodeId)) return { ok: false, why: 'a node voted twice: ' + v.nodeId };
    counted.add(v.nodeId);
    if (v.support) yesWeight += electorate[v.nodeId];
    else noWeight += electorate[v.nodeId];
  }
  const votedWeight = yesWeight + noWeight;
  const quorumMet = votedWeight * 100 >= bylaws.quorum * totalWeight;
  const passed = quorumMet && yesWeight * 100 >= bylaws.passThreshold * votedWeight;
  return { ok: true, totalWeight, yesWeight, noWeight, votedWeight, quorumMet, passed };
}

/**
 * decide(nodes, votes, bylaws) — the whole fold in one call. Tallies the SAME votes twice: once on RAW
 * contribution (what mesh-governance alone would use, blind to self) and once on the STEWARD electorate
 * (cripples zeroed). `flipped` is true when the steward gate changed the pass/fail outcome — the proof that
 * gating governance by self-persistence is load-bearing, not decorative.
 */
export function decide(nodes, votes, bylaws) {
  const se = stewardElectorate(nodes);
  if (!se.ok) return { ok: false, why: 'nodes: ' + se.why };
  const raw = {};
  for (const id of Object.keys(nodes)) raw[id] = nodes[id].contribution;   // every node validated by stewardElectorate above
  const rawOut = outcome(raw, votes, bylaws);
  if (!rawOut.ok) return { ok: false, why: 'raw tally: ' + rawOut.why };
  const stewardOut = outcome(se.electorate, votes, bylaws);
  if (!stewardOut.ok) return { ok: false, why: 'steward tally: ' + stewardOut.why };
  return { ok: true, barred: se.barred, raw: rawOut, steward: stewardOut, flipped: rawOut.passed !== stewardOut.passed };
}
