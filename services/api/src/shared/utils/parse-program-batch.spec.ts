import { parseProgramBatch } from './parse-program-batch';

describe('parseProgramBatch', () => {
  it('splits a trailing "Batch <token>" suffix off the program name', () => {
    expect(parseProgramBatch('Japan Youth Summit 2026 Batch 2')).toEqual({
      displayName: 'Japan Youth Summit 2026',
      batch: '2',
    });
  });

  it('returns the name unchanged with an empty batch when there is no batch suffix', () => {
    expect(parseProgramBatch('Japan Youth Summit 2026')).toEqual({
      displayName: 'Japan Youth Summit 2026',
      batch: '',
    });
  });

  it('handles a dash-separated "- Batch <token>" variant', () => {
    expect(parseProgramBatch('Japan Youth Summit 2026 - Batch 2')).toEqual({
      displayName: 'Japan Youth Summit 2026',
      batch: '2',
    });
  });
});
