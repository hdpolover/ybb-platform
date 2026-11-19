// services/api/src/modules/programs/application/copy/program-copier.registry.spec.ts
import { NotFoundException } from '@nestjs/common';
import { ProgramCopierRegistry } from './program-copier.registry';
import { ProgramCopier } from './program-copier.interface';
import { ProgramsModule } from '../../programs.module';
import { CONTENT_WRITE_PERMISSIONS } from '../utils/program-content-access.util';

function fakeCopier(key: string): ProgramCopier {
  return {
    key,
    label: key,
    supportsAppend: true,
    requiredPermissions: ['program:write'],
    countFor: jest.fn(),
    preview: jest.fn(),
    copy: jest.fn(),
    exportTemplate: jest.fn(),
    applyTemplate: jest.fn(),
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

  it('constructor throws when two copiers share a key', () => {
    const first = fakeCopier('faqs');
    const duplicate = fakeCopier('faqs');
    expect(() => new ProgramCopierRegistry(first, duplicate)).toThrow(
      /faqs/,
    );
  });
});

// Walks the copiers the module really registers: a copier with no permission
// set made POST copy / apply-template / clone-from a way around the entity's
// own write gate (pricing tiers included).
describe('registered copiers', () => {
  const providers = (Reflect.getMetadata('providers', ProgramsModule) ?? []) as Array<{ provide?: unknown; inject?: unknown[] }>;
  const registryProvider = providers.find((p) => p?.provide === ProgramCopierRegistry);
  const copierClasses = (registryProvider?.inject ?? []) as Array<new (...args: unknown[]) => ProgramCopier>;
  const knownSets = Object.values(CONTENT_WRITE_PERMISSIONS).map((set) => [...set].sort().join(','));

  it('finds the registry factory and its copiers', () => {
    expect(copierClasses.length).toBeGreaterThanOrEqual(15);
  });

  it.each(copierClasses.map((C) => [C.name, C] as const))('%s declares a CONTENT_WRITE_PERMISSIONS set', (_name, Copier) => {
    const copier = new Copier({});
    expect(copier.requiredPermissions.length).toBeGreaterThan(0);
    expect(knownSets).toContain([...copier.requiredPermissions].sort().join(','));
  });
});
