import { it, expect } from 'vitest';
import { PROBLEMS } from './problems';
it('distinguishes generic search, research status and endpoint knowledge',()=>{
 const p=PROBLEMS[0]!;
 expect(p.plain).toContain('generic graph search');
 expect(p.precise).toContain('both endpoint');
 expect(p.precise).toContain('GRH');
 expect(p.precise).toContain('smoothness heuristic');
 expect(p.precise).toContain('unrefereed preprint');
 expect(p.precise).toContain('prescribed-degree');
 expect(PROBLEMS[2]!.precise).toContain('2026');
});
