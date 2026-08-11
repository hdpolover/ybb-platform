// services/api/src/modules/scoring/domain/scoring-calculation.mirror.spec.ts
import { readFileSync } from 'fs';
import { join } from 'path';

// The admin dashboard cannot import from services/api (separate npm packages,
// no workspace linking), so it keeps a mirror copy. This test fails the moment
// the two diverge, turning silent score drift into a red build.
const SOURCE = join(__dirname, 'scoring-calculation.ts');
const MIRROR = join(
  __dirname,
  '../../../../../admin-dashboard/src/shared/scoring-calculation.ts',
);

/** Strip the leading comment block so the two file-path headers can differ. */
function body(contents: string): string {
  return contents
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')
    .trim();
}

describe('scoring-calculation mirror', () => {
  it('keeps the admin dashboard copy identical to the API source', () => {
    expect(body(readFileSync(MIRROR, 'utf8'))).toBe(
      body(readFileSync(SOURCE, 'utf8')),
    );
  });
});
