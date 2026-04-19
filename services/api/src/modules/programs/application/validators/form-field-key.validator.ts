import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { isMagicFormFieldKey } from '../constants/magic-form-fields';

export const FIELD_KEY_FORMAT = /^[a-z][a-z0-9_]{0,63}$/;

export class FieldKeyValidationError extends Error {
  constructor(
    public readonly code:
      | 'invalid_format'
      | 'reserved_magic'
      | 'reserved_catalog',
    message: string,
  ) {
    super(message);
    this.name = 'FieldKeyValidationError';
  }
}

@Injectable()
export class FormFieldKeyValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validateCustomKey(key: string): Promise<void> {
    if (!FIELD_KEY_FORMAT.test(key)) {
      throw new FieldKeyValidationError(
        'invalid_format',
        `Field key "${key}" is invalid. Use lowercase letters, digits, and underscores; must start with a letter; max 64 chars.`,
      );
    }
    if (isMagicFormFieldKey(key)) {
      throw new FieldKeyValidationError(
        'reserved_magic',
        `"${key}" is a reserved system key — pick it from the System Field catalog instead.`,
      );
    }
    const catalogHits = await this.prisma.systemFormFieldDefinition.findMany({
      where: { key, deletedAt: null },
      select: { key: true, isActive: true },
    });
    if (catalogHits.some((hit) => hit.isActive)) {
      throw new FieldKeyValidationError(
        'reserved_catalog',
        `"${key}" is a system field — pick it from the catalog instead.`,
      );
    }
  }
}
