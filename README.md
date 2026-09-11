# steward-gate

**▶ Live: https://sjgant80-hub.github.io/steward-gate/**

**Who may steer the kernel.** A mesh weights a vote by **contribution** — units earned by verified work — which
is anti-Sybil (a fresh fork has zero contribution, zero weight). But contribution-weight is blind to whether a
heavy earner can hold a **self**. A node can grind *build* and *explore* work, bank units, and never *verify* or
*remember*: a **provably-fit cripple** ([build-geometry](https://github.com/sjgant80-hub/build-geometry)) that
still accrues weight over a kernel it has no memory to guard across time.

The gate: a node's earned units become **steering weight only if it holds a self** — `verify` **and** `remember`,
each at or above κ (0.618). Otherwise it keeps its units but carries **zero weight over the kernel**. You may
earn; you may only steer if you hold a self.

## Why *verify* + *remember*

In [build-geometry](https://github.com/sjgant80-hub/build-geometry) the two **scarce** shapes that persist a self
are the **octahedron** (verify — tell real from fake) and the **dodecahedron** (remember — hold the history).
Those are exactly the two capacities steering a kernel requires:

- a node that **cannot verify** cannot tell a real proposal from a forged one;
- a node that **cannot remember** re-litigates settled decisions and can be replayed.

So the geometry and the governance meet at the same two shapes. That is the fold.

## The law (`kernel.mjs`)

- `holdsSelf(phases)` — does the node hold a self? Both `verify` and `remember` at/above κ.
- `stewardWeight(node)` — earned units → weight, **iff** it holds a self; else 0 (it keeps the units).
- `stewardElectorate(nodes)` — the drop-in electorate `{ nodeId: weight }` (cripples zeroed) + `barred`.
- `outcome(electorate, votes, bylaws)` — the contribution-weighted, integer-exact tally.
- `decide(nodes, votes, bylaws)` — tallies the **same votes twice**, on raw contribution and on the steward
  electorate; `flipped` is true when the gate changed the pass/fail outcome.

Pure and total: the kernel never throws on garbage; it returns `{ ok: false, why }`.

## Composes the estate

- [build-geometry](https://github.com/sjgant80-hub/build-geometry) — the scarce self-shapes (verify + remember) and the κ floor.
- [mesh-governance](https://github.com/sjgant80-hub/mesh-governance) — the contribution-weighted tally and the unvotable kernel. The steward electorate is exactly the shape it already consumes, so this gate drops in front, unchanged.
- [kcc-mesh](https://github.com/sjgant80-hub/kcc-mesh) — where contribution units are earned (re-verified work).

The recurse fold: **build-geometry ⊕ mesh-governance** — governance weight gated by geometric self-persistence.
The money rail stays gated behind counsel; this changes *who may steer*, never *what may be voted*.

## Honest scope

**Real:** the gating logic and the tally — pure, total, mutation-gated. The claim it proves is narrow and
mechanical: contribution-weight alone lets a fit-cripple steer, and requiring `verify + remember` closes that.
**Lens (kept private):** the solids-as-organs cosmology is a way to see it, not a claim on the surface.

## Proof of play

- **Mutation-gated CLEAN** — `node tools/witness.mjs mutate kernel.mjs --timeout 30000 --cap 500 --test node --test kernel.test.mjs`
- **The live page IS the gated kernel** — `make-page.mjs` injects `kernel.mjs` verbatim; CI regenerates and `git diff --exit-code`s.
- Run the tests: `node --test kernel.test.mjs`

MIT.
