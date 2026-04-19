const MAX_LEN = 64;

export function autoSlug(input: string): string {
  if (!input) return '';
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return '';
  const prefixed = /^[0-9]/.test(normalized) ? `f_${normalized}` : normalized;
  return prefixed.slice(0, MAX_LEN);
}

export function autoSlugWithCollisionSuffix(
  label: string,
  taken: Set<string>,
): string {
  const base = autoSlug(label);
  if (!base || !taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}
