import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Standards reviewed 15 November 2026.
 *
 * NIST IR 8610 (May 2026) closed the second round of the Additional Digital
 * Signature Schemes process on 14 May 2026 and selected nine candidates for the
 * third round; SQIsign is the only isogeny-based one. The Real-World Usage
 * entry said "NIST post-quantum signature on-ramp", which does not date itself
 * and does not say whether SQIsign is still a candidate.
 *
 * The in-page research notes already say "Round-3 SQIsign", so the round label
 * itself was right; what was missing was when it got there and on whose word.
 *
 * This atlas computes a graph over GF(431²) and does not implement SQIsign, so
 * it quotes none of the round-3 specification's parameters or timings. That
 * disclaimer is asserted too, because the honest reason not to print the spec's
 * cycle counts here is that nothing on this page measures them.
 */
const readme = readFileSync('README.md', 'utf8');

it('the SQIsign entry states the round 3 advancement with its date and source', () => {
  expect(readme).toMatch(/\*\*SQIsign\*\*[\s\S]{0,400}advanced to round 3/);
  expect(readme).toMatch(/\*\*SQIsign\*\*[\s\S]{0,400}14 May 2026/);
  expect(readme).toMatch(/\*\*SQIsign\*\*[\s\S]{0,400}NIST IR 8610/);
});

it('cites the CSRC round 3 announcement, not a nist.gov news path', () => {
  expect(readme).toContain(
    'https://csrc.nist.gov/News/2026/nist-advances-9-candidates-to-the-3rd-round-of-pqc',
  );
});

it('carries the dated standards note and disclaims figures it does not compute', () => {
  expect(readme).toMatch(/\*\*Standards reviewed 15 November 2026:\*\*/);
  expect(readme).toMatch(/does not implement SQIsign/);
  expect(readme).toMatch(/none of the round-3 specification's parameters or timings/);
});
