/**
 * The seven open problems, each expressed as a structure on the graph.
 * Copy discipline: every claim must be exactly true of the exact construction;
 * paraphrases are labelled as paraphrases (the in-page source note points to
 * ePrint 2026/1431 for the experts' precise statements).
 */

export interface Problem {
  readonly n: number;
  readonly title: string;
  /** The graph object this problem IS, shown as a chip above the title. */
  readonly tagline: string;
  /** Plain-language card: 2–4 sentences, no math prerequisites. */
  readonly plain: string;
  /** Expert layer inside <details>: precise statement + stakes. HTML. */
  readonly precise: string;
  /**
   * Rendered model-boundary note (HTML) for widgets whose walk semantics are a
   * teaching simplification of the kernel-labelled objects (Problems 4, 5, 7).
   */
  readonly boundary?: string;
  readonly refs: ReadonlyArray<{ label: string; url: string }>;
  /** Label for the widget's action button (widgets are wired in main.ts). */
  readonly action: string;
}

export const PROBLEMS: readonly Problem[] = [
  {
    n: 1,
    title: 'The Path-Finding Problem',
    tagline: 'a path between two vertices',
    plain:
      'Given two curves in the atlas, find any isogeny between them — any path at all. This is the bedrock: if someone finds a fast way to do it, essentially all of isogeny-based cryptography falls at once. On this toy graph a search finds the path in a blink; at p ≈ 2²⁵⁶ the best known methods need on the order of √p ≈ 2¹²⁸ steps.',
    precise:
      '<p><strong>Problem.</strong> Given two supersingular elliptic curves E₁, E₂ over GF(p²), output an isogeny φ : E₁ → E₂ (equivalently, a path in the ℓ-isogeny graph) in some efficient representation.</p><p><strong>What is known.</strong> Generic meet-in-the-middle attacks cost Õ(√p); quantum algorithms give a smaller exponent, though their true memory and hardware costs are debated. The problem is broken when either endpoint has a known endomorphism ring — which is exactly why Problem 2 matters. Paths <em>exist</em> in abundance (these graphs are Ramanujan expanders with diameter O(log p)); the hardness is entirely about finding one.</p><p><strong>Stakes.</strong> This is the assumption beneath the CGL hash and, via the reductions in Problems 2–3, beneath SQIsign — the isogeny signature scheme in NIST’s post-quantum on-ramp.</p>',
    refs: [
      {
        label: 'Charles–Goren–Lauter 2006 (the hash that started it)',
        url: 'https://eprint.iacr.org/2006/021',
      },
      {
        label: 'De Feo, "Mathematics of isogeny based cryptography"',
        url: 'https://arxiv.org/abs/1711.04062',
      },
    ],
    action: 'Hide two curves, then reveal the path',
  },
  {
    n: 2,
    title: 'The Endomorphism Ring Problem',
    tagline: 'all the cycles through one vertex',
    plain:
      'Every closed loop through a vertex is an isogeny from that curve back to itself — an endomorphism. Collect enough independent loops and you have computed the curve’s endomorphism ring, its complete algebraic fingerprint. Computing that ring for a given curve is provably just as hard as finding paths: the two problems stand or fall together.',
    precise:
      '<p><strong>Problem.</strong> Given a supersingular curve E over GF(p²), compute its endomorphism ring End(E) — a maximal order in the quaternion algebra B<sub>p,∞</sub> — say by four endomorphisms forming a ℤ-basis.</p><p><strong>What is known.</strong> Path-finding and endomorphism-ring computation are equivalent — proved under GRH by Wesolowski (FOCS 2021), building on Eisenträger–Hallgren–Lauter–Morrison–Petit, and since made unconditional by Page–Wesolowski. Under the Deuring correspondence, knowing End(E) unlocks the quaternion world where path-finding is easy (KLPT). No subexponential algorithm is known for an arbitrary curve.</p><p><strong>Stakes.</strong> SQIsign’s secret key <em>is</em> knowledge of an endomorphism ring; this problem is its security floor.</p>',
    refs: [
      {
        label: 'Wesolowski 2021 — path ⇔ End ring (FOCS)',
        url: 'https://arxiv.org/abs/2111.01481',
      },
      {
        label: 'Kohel 1996 (the thesis that began it)',
        url: 'https://www.i2m.univ-amu.fr/perso/david.kohel/pub/thesis.pdf',
      },
    ],
    action: 'Show cycles through a vertex',
  },
  {
    n: 3,
    title: 'The One Endomorphism Problem',
    tagline: 'a single cycle through a vertex',
    plain:
      'Surely finding just one loop through a vertex is easier than finding all of them? Remarkably, no: Page and Wesolowski proved that computing even a single non-trivial endomorphism of a curve is as hard as computing its whole endomorphism ring. One loop is the thread that unravels the entire sweater.',
    precise:
      '<p><strong>Problem.</strong> Given a supersingular curve E, find one endomorphism of E that is not multiplication-by-m for any integer m — as a single cycle in the graph, one closed walk based at E.</p><p><strong>What is known.</strong> Page–Wesolowski (Eurocrypt 2024) reduced the full endomorphism-ring problem to this one: from a single non-scalar endomorphism one can, with polynomially many self-reductions, recover the whole ring. So Problems 1, 2 and 3 form one equivalence class of hardness. The open question is whether <em>any</em> of them admits a better-than-generic algorithm.</p><p><strong>Stakes.</strong> Security proofs prefer weak-looking assumptions; this equivalence means schemes can lean on "no one can find even one endomorphism" — the weakest of the three formulations — at no loss.</p>',
    refs: [
      {
        label: 'Page–Wesolowski 2024 — one endomorphism suffices',
        url: 'https://eprint.iacr.org/2023/1448',
      },
    ],
    action: 'Show one cycle',
  },
  {
    n: 4,
    title: 'The Fixed-Degree Isogeny Problem',
    tagline: 'paths of one exact length',
    plain:
      'Now a twist: find a path between two curves of one exact, prescribed length — an isogeny of one exact degree. Some degrees make the problem no easier than the general one; the SIDH scheme fell in 2022 because revealing extra data about a fixed-degree isogeny (its action on chosen points) let attackers rebuild it outright. Where exactly the hard/easy boundary sits is open. The widget below highlights the graph shadow of this problem: endpoints of length-k walks (see the model note in the expert layer).',
    boundary:
      '<strong>Model note.</strong> The widget walks vertex-to-vertex on the computed adjacency: parallel isogenies to the same neighbor are collapsed into one step, "no immediate return" refers to the previous <em>vertex</em> rather than the dual isogeny, and behavior at the two extra-automorphism vertices (j = 0, j ≡ 1728) is simplified accordingly. So "endpoints of length-k walks" is the standard teaching shadow of "codomains of cyclic degree-ℓ<sup>k</sup> isogenies", not a kernel-exact enumeration.',
    precise:
      '<p><strong>Problem.</strong> Given a supersingular curve E (or a pair E, E′) and an integer d, find a cyclic isogeny of degree exactly d from E (to E′). In the graph: a non-backtracking walk of length exactly k when d = ℓ^k.</p><p><strong>What is known.</strong> The 2022 attacks of Castryck–Decru, Maino–Martindale and Robert broke SIDH — not by solving this problem, but by exploiting the <em>auxiliary torsion images</em> SIDH published alongside a fixed-degree isogeny. The clean problem, without auxiliary data, stands; its difficulty is known to vary with the arithmetic shape of d, and mapping that landscape is an active frontier. Higher-dimensional isogenies — the attackers’ tool — have since become a constructive tool too.</p><p><strong>Stakes.</strong> Fixed-degree isogenies are what protocols actually transmit; knowing which degrees are safe determines which protocols can exist.</p>',
    refs: [
      {
        label: 'Castryck–Decru 2022 (the SIDH break)',
        url: 'https://eprint.iacr.org/2022/975',
      },
      {
        label: 'Robert 2022 (breaking SIDH in polynomial time)',
        url: 'https://eprint.iacr.org/2022/1038',
      },
    ],
    action: 'Highlight endpoints of exact-length walks',
  },
  {
    n: 5,
    title: 'Hashing Into the Graph',
    tagline: 'a walk you cannot help but remember',
    plain:
      'Type a message below and it walks the graph, one step per bit — a CGL-inspired deterministic bit walk, the same idea as the Charles–Goren–Lauter hash in simplified form (model note in the expert layer). But notice: to land anywhere, you walked there, so you know your own path back to the starting curve. Nobody knows how to produce a "random" supersingular curve without also learning a path to it — and many protocols need exactly such curves of no known origin.',
    boundary:
      '<strong>Model note.</strong> The bit walk is a genuine deterministic walk on the real computed graph, but it is a teaching simplification of the CGL construction: parallel isogenies with the same endpoint are collapsed into one choice, self-loops are skipped, immediate return is forbidden by previous vertex rather than by dual isogeny, and bits index neighbors in a canonical order rather than selecting kernel subgroups. A production CGL hash fixes kernel-level conventions instead; the security story told here is unaffected.',
    precise:
      '<p><strong>Problem.</strong> Efficiently sample a supersingular curve over GF(p²) such that nobody — including the sampler — can compute its endomorphism ring; equivalently, hash into the supersingular set without revealing a path from a known base curve.</p><p><strong>What is known.</strong> Every known generation method either starts from a special curve (like j = 1728, whose ring is known) and walks — revealing the walk — or uses CM constructions that reveal the ring by design. Booher et al. ("Failing to hash into supersingular isogeny graphs") surveyed the candidate approaches and found them all wanting. Trusted setup (one party walks, then forgets) is the unsatisfying workaround.</p><p><strong>Stakes.</strong> Verifiable delay functions, oblivious PRFs, and several signature variants on isogenies all want a curve of unknown endomorphism ring as a public parameter; without this problem solved they need trusted setup.</p>',
    refs: [
      {
        label: 'Booher et al. 2022 — failing to hash',
        url: 'https://eprint.iacr.org/2022/518',
      },
    ],
    action: 'Walk the hash of your message',
  },
  {
    n: 6,
    title: 'The Group-Action (Vectorization) Problem',
    tagline: 'the GF(431) spine',
    plain:
      'The square vertices — curves whose j-invariant lies in the small field GF(431) — form a special sub-world with extra symmetry: a commutative group shuffles them around, which is what the CSIDH key exchange is built on. The catch: that same symmetry gives quantum computers a foothold (Kuperberg’s algorithm), subexponential but not efficient. Whether it can be pushed to a practical break is a major open question.',
    precise:
      '<p><strong>Problem.</strong> For curves with an orientation by an imaginary quadratic order 𝒪 (over GF(p): the spine, acted on by the class group cl(𝒪)): given E and E′ = 𝔞 ⋆ E, find the ideal class 𝔞. This is the vectorization problem of Couveignes.</p><p><strong>What is known.</strong> The commutative structure admits Kuperberg’s quantum algorithm for the hidden-shift problem — subexponential, roughly exp(Õ(√log p)) — which does not apply to the full unstructured graph. The concrete quantum security of CSIDH-sized parameters is contested; whether Kuperberg can be substantially improved, or the action hardened, is open. (This atlas shows the honest small picture: the spine with its conjugation symmetry. Orientations and twists are finer than the drawing — see the paper.)</p><p><strong>Stakes.</strong> Group actions give isogeny crypto its only drop-in Diffie–Hellman replacement and its most flexible advanced protocols; their fate hangs on this problem.</p>',
    refs: [
      {
        label: 'CSIDH — Castryck, Lange, Martindale, Panny, Renes 2018',
        url: 'https://eprint.iacr.org/2018/383',
      },
      {
        label: 'Kuperberg — quantum hidden-shift',
        url: 'https://arxiv.org/abs/quant-ph/0302112',
      },
    ],
    action: 'Highlight the spine',
  },
  {
    n: 7,
    title: 'Collisions, or Cycles From Nowhere',
    tagline: 'two different paths, same endpoints',
    plain:
      'Two different paths between the same two curves glue into a loop — an endomorphism. On this toy graph the collision-finder below finds such a pair instantly, by brute force. At real size, finding any collision starting from a curve of unknown endomorphism ring is believed as hard as Problem 3 — which is precisely the collision resistance of the isogeny hash from Problem 5.',
    boundary:
      '<strong>Model note.</strong> The collision finder enumerates the same simplified bit walk as Problem 5 (parallel edges collapsed, self-loops skipped, previous-vertex non-backtracking, canonical neighbor order). The collision it exhibits is real — two genuinely different walks in the genuine graph with the same endpoint — but the walk model is the teaching simplification, not a kernel-labelled CGL transition system.',
    precise:
      '<p><strong>Problem.</strong> Given a starting supersingular curve E₀ with unknown endomorphism ring, find two distinct non-backtracking walks from E₀ with the same endpoint (a collision of the CGL hash), or equivalently a non-trivial cycle — an endomorphism — reachable from E₀.</p><p><strong>What is known.</strong> From a curve with <em>known</em> endomorphism ring, collisions can be manufactured (Petit–Lauter; Eisenträger et al. study the cycle structure) — which is why Problem 5’s trusted setup matters: CGL hashing is only collision-resistant from a base curve of unknown ring. A collision yields an endomorphism, connecting this problem back to Problems 2–3; the exact quantitative relationship between collision-finding and the endomorphism problems at concrete sizes is still being mapped.</p><p><strong>Stakes.</strong> Hash functions from expander walks were the field’s first application; whether they can ever be instantiated without trusted setup rests here and on Problem 5.</p>',
    refs: [
      {
        label: 'Petit–Lauter 2017 — hard and easy problems for these graphs',
        url: 'https://eprint.iacr.org/2017/962',
      },
      {
        label: 'Eisenträger et al. — cycles in the ℓ-isogeny graph',
        url: 'https://arxiv.org/abs/1804.04063',
      },
    ],
    action: 'Find a real collision (brute force)',
  },
];
