// src/modules/users/presentation/dto/deletion-request.dto.spec.ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDeletionRequestDto, DELETION_REASON_CATEGORIES } from './deletion-request.dto';

const check = (plain: Record<string, unknown>) => validate(plainToInstance(CreateDeletionRequestDto, plain));

describe('CreateDeletionRequestDto', () => {
  it('accepts an empty body (reason is optional)', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it.each(DELETION_REASON_CATEGORIES)('accepts category %s', async (reasonCategory) => {
    expect(await check({ reasonCategory })).toHaveLength(0);
  });

  it('rejects an unknown reasonCategory', async () => {
    const errors = await check({ reasonCategory: 'because' });
    expect(errors.map((e) => e.property)).toContain('reasonCategory');
  });

  it('rejects free text longer than 500 chars', async () => {
    const errors = await check({ reason: 'x'.repeat(501) });
    expect(errors.map((e) => e.property)).toContain('reason');
  });

  it('accepts exactly 500 chars and trims surrounding whitespace', async () => {
    const dto = plainToInstance(CreateDeletionRequestDto, { reason: `  ${'x'.repeat(500)}  ` });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.reason).toHaveLength(500);
  });
});
