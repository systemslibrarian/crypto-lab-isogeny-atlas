# crypto-lab-isogeny-atlas

## What It Is

A browser atlas of the **supersingular isogeny graph** — the mathematical object
whose navigation difficulty underwrites isogeny-based post-quantum cryptography
(the family that includes SQIsign and CSIDH). The page computes a **real**
supersingular ℓ-isogeny graph over `GF(431²)`: vertices are the 37 supersingular
j-invariants, and two vertices are joined exactly when the classical modular
polynomial `Φ_ℓ(j, j′)` vanishes, for ℓ = 2 and ℓ = 3. It then presents the
**seven foremost open problems** of isogeny-based cryptography — following
Castryck, De Feo, Galbraith, Kutas, Reijnders and Wesolowski,
["The Isogeny Problems"](https://eprint.iacr.org/2026/1431) (ePrint 2026/1431) —
each drawn as a concrete structure on that graph: a path, a cycle, a walk, a
distinguished subset.

The prime is deliberately tiny (p = 431 instead of p ≈ 2²⁵⁶) so every vertex
fits on screen; the page and this README say so wherever it matters. **This is
an educational atlas, not an attack lab, a key-exchange demo, or production
crypto.**

### What is real here, and what is not

| Component | Status |
|---|---|
| `GF(431²)` field arithmetic (`fp2.ts`) | **Real**, exact (i² = −1, p ≡ 3 mod 4) |
| Modular polynomials Φ₂, Φ₃ (`modpoly.ts`) | **Real** classical integer coefficients, BigInt-exact |
| Vertex/edge discovery (`graph.ts`) | **Real** BFS with genuine polynomial factorization (square-free reduction + Cantor–Zassenhaus, seeded) |
| Supersingularity verification (`curve.ts`, tests) | **Real** independent check via Weierstrass point arithmetic and Frobenius-trace group orders |
| Self-checks shown in-page | **Real**: vertex count ⌊p/12⌋+2, Eichler mass formula, (ℓ+1)-regularity, all recomputed live |
| Path search, cycles, exact-length walks (`walk.ts`) | **Real** graph algorithms on the computed graph |
| "Hash" walk (Problem 5) | **Real** CGL-style walk driven by actual message bits, with a simplified edge-ordering convention (labelled in-page) |
| Collision finder (Problem 7) | **Real** brute-force enumeration — feasible only because p is tiny, which is the lesson |
| The seven problem statements | Teaching **paraphrases** of the literature; the page links the paper for the experts' precise write-ups |

## Exhibits

1. **The atlas, computed — not drawn.** The graph is built live at page load by
   factoring `Φ_ℓ(j, Y)` over `GF(431²)` starting from j = 1728. Toggle 2- vs
   3-isogeny edges, inspect any vertex (curve model, conjugate, automorphisms,
   neighbors), and open the details panel for the live structural self-checks
   and the raw adjacency list. Square vertices mark the `GF(431)` "spine".
2. **Find the path — feel the hard problem.** Walk from curve to curve by hand,
   then let breadth-first search flood the graph (animated or step-by-step) and
   compare your route to the optimum. A scaling table shows why the same search
   is hopeless at p ≈ 2²⁵⁶.
3. **The seven open problems**, each as a structure on the graph, with
   newcomer-first text and a "precise problem & stakes" expert layer:
   path-finding · the endomorphism ring · one endomorphism · fixed-degree
   isogenies · hashing into the graph · the group-action (vectorization)
   problem · collisions and cycles. Every problem has a live widget — reveal a
   path, draw cycles, slide the exact degree, hash your own message, highlight
   the spine, find a genuine collision.

## When to Use It

- **Teaching post-quantum cryptography** — this shows the *object* isogeny
  security lives on, complementing lattice- and hash-based demos.
- **Reading the isogeny literature** — the seven problems give a map: when a
  paper says "endomorphism ring computation", you have seen it as cycles.
- **Understanding why SQIsign's security is graph navigation**, not equation
  solving.
- **Do NOT use it** to generate keys, hash data, or estimate concrete security:
  it is a demo app over a 9-bit prime and does not provide hardened
  operational controls.

## Live Demo

<https://systemslibrarian.github.io/crypto-lab-isogeny-atlas/>

Toggle edge sets, inspect all 37 curves, race breadth-first search by hand,
step through the seven problems, hash a message into the graph, and brute-force
a real hash collision — everything computed in your browser.

## What Can Go Wrong

- **Reading toy sizes as security estimates.** Every count on the page (37
  vertices, 33-curve floods, instant collisions) is honest for p = 431 and
  meaningless at p ≈ 2²⁵⁶ except through the stated scaling laws.
- **"Non-backtracking" subtleties.** At the two extra-automorphism vertices
  (j = 0, j ≡ 1728) and at multi-edges, the standard walk conventions are
  subtler than a toy can show; the page uses the usual teaching simplification
  (no immediate returns) and says so.
- **Paraphrase drift.** The seven problem statements are paraphrases; the
  authoritative statements are the experts' write-ups in ePrint 2026/1431,
  linked in-page.

## Real-World Usage

- **SQIsign** (NIST post-quantum signature on-ramp) — secret keys are
  endomorphism rings; security is Problems 1–4.
- **CSIDH and group-action protocols** — Problem 6, on the spine.
- **CGL-style expander hashes and VDF proposals** — Problems 5 and 7.

## How to Run Locally

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest — 54 unit tests incl. the spec KATs
npm run build      # typecheck + production build
npm run test:a11y  # axe-core WCAG 2.1 AA gate, both themes (port 4329)
```

## Related Demos

- [crypto-lab-isogeny-gate](https://systemslibrarian.github.io/crypto-lab-isogeny-gate/) — a working toy CSIDH key exchange and the SIDH/Castryck–Decru story
- [crypto-lab-ec-point-arithmetic](https://systemslibrarian.github.io/crypto-lab-ec-point-arithmetic/) — the elliptic-curve group law this builds on
- [crypto-lab-pq-families](https://systemslibrarian.github.io/crypto-lab-pq-families/) — where isogenies sit among the post-quantum families

## Build & Verify

- **54 Vitest unit tests**, colocated in `src/`, including **17 numbered spec
  KATs**: classical CM identities for Φ₂/Φ₃ in exact integers
  (e.g. `Φ₂(1728, 66³) = 0`, `Φ₂(8000, 8000) = 0`, `Φ₃(0, −12288000) = 0`),
  the 37-vertex count, the Eichler mass formula `Σ 1/|Aut| = (p−1)/24`,
  (ℓ+1)-regularity, connectivity, Galois stability, and an independent
  supersingularity verification of all 37 curves by Frobenius-trace point
  arithmetic — plus a control test proving ordinary curves *fail* it.
- **Accessibility gate:** `@axe-core/playwright` scans the production build in
  **both themes** after driving every exhibit into its post-interaction state;
  zero WCAG 2.1 A/AA violations, enforced in CI before deploy.
- **Deploy:** GitHub Actions → Pages; unit tests, typecheck, build, and the
  a11y gate all block the deploy.

## Performance

The whole graph — two rounds of polynomial factorization over `GF(431²)` for
37 vertices — computes in under ~150 ms in the browser at page load; the
timing is displayed live in Exhibit 1.

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
