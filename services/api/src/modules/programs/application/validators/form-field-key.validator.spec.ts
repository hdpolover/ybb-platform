import {
  FormFieldKeyValidator,
  FIELD_KEY_FORMAT,
  FieldKeyValidationError,
} from './form-field-key.validator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('FIELD_KEY_FORMAT', () => {
  it.each([
    ['tshirt_size', true],
    ['full_name', true],
    ['a', true],
    ['a1', true],
    ['field_64__' + 'x'.repeat(54), true],
    ['TShirtSize', false],
    ['_leading', false],
    ['1leading', false],
    ['has space', false],
    ['has-hyphen', false],
    ['', false],
    ['x'.repeat(65), false],
  ])('matches %s → %s', (key, expected) => {
    expect(FIELD_KEY_FORMAT.test(key)).toBe(expected);
  });
});

describe('FormFieldKeyValidator', () => {
  const mkPrisma = (rows: Array<{ key: string; isActive: boolean }>) =>
    ({
      systemFormFieldDefinition: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    }) as unknown as PrismaService;

  it('rejects invalid format', async () => {
    const validator = new FormFieldKeyValidator(mkPrisma([]));
    await expect(validator.validateCustomKey('Bad Key')).rejects.toBeInstanceOf(
      FieldKeyValidationError,
    );
  });

  it('rejects a magic key', async () => {
    const validator = new FormFieldKeyValidator(mkPrisma([]));
    await expect(validator.validateCustomKey('category')).rejects.toBeInstanceOf(
      FieldKeyValidationError,
    );
  });

  it('rejects an active DB catalog key', async () => {
    const validator = new FormFieldKeyValidator(
      mkPrisma([{ key: 'tshirt_size', isActive: true }]),
    );
    await expect(validator.validateCustomKey('tshirt_size')).rejects.toBeInstanceOf(
      FieldKeyValidationError,
    );
  });

  it('allows a key matching only an INACTIVE catalog entry', async () => {
    const validator = new FormFieldKeyValidator(
      mkPrisma([{ key: 'tshirt_size', isActive: false }]),
    );
    await expect(validator.validateCustomKey('tshirt_size')).resolves.toBeUndefined();
  });

  it('allows a fresh custom key', async () => {
    const validator = new FormFieldKeyValidator(mkPrisma([]));
    await expect(
      validator.validateCustomKey('custom_field_x'),
    ).resolves.toBeUndefined();
  });
});
