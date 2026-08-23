// services/api/src/modules/programs/application/copy/program-copier.registry.spec.ts
import { NotFoundException } from '@nestjs/common';
import { ProgramCopierRegistry } from './program-copier.registry';
import { ProgramCopier } from './program-copier.interface';

function fakeCopier(key: string): ProgramCopier {
  return {
    key,
    label: key,
    supportsAppend: true,
    countFor: jest.fn(),
    preview: jest.fn(),
    copy: jest.fn(),
  };
}

describe('ProgramCopierRegistry', () => {
  it('get() returns the copier registered under that key', () => {
    const faqs = fakeCopier('faqs');
    const timelines = fakeCopier('timelines');
    const registry = new ProgramCopierRegistry(faqs, timelines);
    expect(registry.get('faqs')).toBe(faqs);
    expect(registry.get('timelines')).toBe(timelines);
  });

  it('get() throws NotFoundException for an unknown key', () => {
    const registry = new ProgramCopierRegistry(fakeCopier('faqs'));
    expect(() => registry.get('not-a-real-key')).toThrow(NotFoundException);
  });

  it('list() returns every registered copier', () => {
    const faqs = fakeCopier('faqs');
    const timelines = fakeCopier('timelines');
    const registry = new ProgramCopierRegistry(faqs, timelines);
    expect(registry.list()).toEqual([faqs, timelines]);
  });
});
