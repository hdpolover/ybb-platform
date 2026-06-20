import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertScoringRubricDto, UpsertCategoryDto, UpsertCriterionDto } from './scoring-rubric.dto';

const validCriterion = {
  name: 'Leadership',
  weight: 0.5,
  maxScore: 100,
  order: 0,
};

const validCategory = {
  name: 'Essay',
  weight: 0.6,
  order: 0,
  criteria: [validCriterion],
};

const validRubricPayload = {
  name: 'IYS 2026 Application Rubric',
  categories: [validCategory],
};

describe('UpsertCriterionDto', () => {
  it('passes with valid fields', async () => {
    const dto = plainToInstance(UpsertCriterionDto, validCriterion);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when name is empty', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, name: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when weight is negative', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, weight: -0.1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'weight')).toBe(true);
  });

  it('fails when maxScore is zero', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, maxScore: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'maxScore')).toBe(true);
  });

  it('fails when maxScore is negative', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, maxScore: -5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'maxScore')).toBe(true);
  });

  it('fails when order is not an integer', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, order: 1.5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'order')).toBe(true);
  });

  it('allows optional id field', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpsertCategoryDto', () => {
  it('passes with valid fields including nested criteria', async () => {
    const dto = plainToInstance(UpsertCategoryDto, validCategory);
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
  });

  it('fails when name is empty', async () => {
    const dto = plainToInstance(UpsertCategoryDto, { ...validCategory, name: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when weight is negative', async () => {
    const dto = plainToInstance(UpsertCategoryDto, { ...validCategory, weight: -0.1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'weight')).toBe(true);
  });

  it('fails when criteria array is missing', async () => {
    const dto = plainToInstance(UpsertCategoryDto, { name: 'Essay', weight: 0.5, order: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'criteria')).toBe(true);
  });
});

describe('UpsertScoringRubricDto', () => {
  it('passes with valid payload', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, validRubricPayload);
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
  });

  it('fails when name is empty string', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, { ...validRubricPayload, name: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when categories is missing', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, { name: 'Rubric' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categories')).toBe(true);
  });

  it('allows omitting name (it is optional)', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, { categories: [validCategory] });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
