// services/api/src/modules/programs/application/copy/program-copier.registry.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProgramCopier } from './program-copier.interface';

@Injectable()
export class ProgramCopierRegistry {
  private readonly copiers: Map<string, ProgramCopier>;

  constructor(...copiers: ProgramCopier[]) {
    this.copiers = new Map();
    for (const copier of copiers) {
      if (this.copiers.has(copier.key)) {
        throw new Error(
          `ProgramCopierRegistry: duplicate copier key '${copier.key}'. Each copier must register a unique key.`,
        );
      }
      this.copiers.set(copier.key, copier);
    }
  }

  get(key: string): ProgramCopier {
    const copier = this.copiers.get(key);
    if (!copier) {
      throw new NotFoundException({
        code: 'unknown_copy_entity',
        message: `No copier registered for entity key '${key}'.`,
      });
    }
    return copier;
  }

  list(): ProgramCopier[] {
    return Array.from(this.copiers.values());
  }
}
