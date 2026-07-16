export const INVALID_ESSAY_QUESTION_VALUES = new Set(['-', '--', 'n/a', 'na', 'tbd', 'coming soon']);

export function isRenderableEssayQuestion(question: string): boolean {
  const normalized = question.trim().replace(/\s+/g, ' ');
  if (!normalized) return false;
  return !INVALID_ESSAY_QUESTION_VALUES.has(normalized.toLowerCase());
}

/** Returns val if it is a non-empty string, otherwise undefined. */
export function coalesceStr(val: unknown): string | undefined {
  if (typeof val === 'string' && val !== '') return val;
  return undefined;
}
