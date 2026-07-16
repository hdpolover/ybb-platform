import { coalesceStr, isRenderableEssayQuestion, INVALID_ESSAY_QUESTION_VALUES } from './application-coalesce.helpers';

describe('coalesceStr', () => {
  it('returns undefined for null', () => {
    expect(coalesceStr(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(coalesceStr(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(coalesceStr('')).toBeUndefined();
  });

  it('returns undefined for number', () => {
    expect(coalesceStr(42)).toBeUndefined();
  });

  it('returns the string for a non-empty string', () => {
    expect(coalesceStr('hello')).toBe('hello');
  });

  it('returns a string with spaces as-is', () => {
    expect(coalesceStr('  hi  ')).toBe('  hi  ');
  });
});

describe('isRenderableEssayQuestion', () => {
  it('returns false for empty string', () => {
    expect(isRenderableEssayQuestion('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isRenderableEssayQuestion('   ')).toBe(false);
  });

  it.each([...INVALID_ESSAY_QUESTION_VALUES])('returns false for sentinel value "%s"', (sentinel) => {
    expect(isRenderableEssayQuestion(sentinel)).toBe(false);
  });

  it('returns false for sentinel value with extra whitespace', () => {
    expect(isRenderableEssayQuestion('  n/a  ')).toBe(false);
  });

  it('returns true for a real question', () => {
    expect(isRenderableEssayQuestion('Why do you want to join this program?')).toBe(true);
  });

  it('returns true for a question ending with ?', () => {
    expect(isRenderableEssayQuestion('What is your motivation?')).toBe(true);
  });

  it('returns true for a string that contains a sentinel value but is not just the sentinel', () => {
    expect(isRenderableEssayQuestion('Is this n/a for you?')).toBe(true);
  });
});

describe('personalData coalesce logic', () => {
  it('prefers participant field over personalData when participant field is non-null', () => {
    const participantVal = 'from_participant';
    const pdVal = 'from_pd';
    // Simulates: participant.institution ?? coalesceStr(pd['institution'])
    const result = participantVal ?? coalesceStr(pdVal);
    expect(result).toBe('from_participant');
  });

  it('falls back to personalData when participant field is null', () => {
    const participantVal: string | null = null;
    const pdVal = 'from_pd';
    const result = participantVal ?? coalesceStr(pdVal);
    expect(result).toBe('from_pd');
  });

  it('returns null when both participant field and personalData are null/empty', () => {
    const participantVal: string | null = null;
    const pdVal: unknown = '';
    const result = participantVal ?? coalesceStr(pdVal) ?? null;
    expect(result).toBeNull();
  });
});
