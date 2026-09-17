import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProgramAnnouncementDto, UpdateProgramAnnouncementDto } from './program-announcement.dto';

const basePayload = { content: 'Some announcement body' };

describe('CreateProgramAnnouncementDto.title MaxLength(255)', () => {
  it('accepts a title exactly at the 255-char limit', async () => {
    const dto = plainToInstance(CreateProgramAnnouncementDto, { ...basePayload, title: 'a'.repeat(255) });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a title over the 255-char limit', async () => {
    const dto = plainToInstance(CreateProgramAnnouncementDto, { ...basePayload, title: 'a'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });
});

describe('UpdateProgramAnnouncementDto (inherits MaxLength(255) via PartialType)', () => {
  it('rejects a title over the 255-char limit', async () => {
    const dto = plainToInstance(UpdateProgramAnnouncementDto, { title: 'a'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });
});

describe('CreateProgramAnnouncementDto.slug', () => {
  const errorsFor = async (slug: unknown) => {
    const dto = plainToInstance(CreateProgramAnnouncementDto, { ...basePayload, title: 'T', slug });
    return (await validate(dto)).filter((e) => e.property === 'slug');
  };

  it('is optional', async () => {
    const dto = plainToInstance(CreateProgramAnnouncementDto, { ...basePayload, title: 'T' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['kwon-hae-suk-explores-ai', 'a', '2026-summit', 'x1-y2-z3'])('accepts %s', async (slug) => {
    expect(await errorsFor(slug)).toHaveLength(0);
  });

  it.each([
    'Upper-Case',
    'double--hyphen',
    '-leading',
    'trailing-',
    'under_score',
    'spa ce',
    'caf\u00e9',
    '',
  ])('rejects %j', async (slug) => {
    expect((await errorsFor(slug)).length).toBeGreaterThan(0);
  });

  it('rejects a slug over 200 characters', async () => {
    expect((await errorsFor('a'.repeat(201))).length).toBeGreaterThan(0);
    expect(await errorsFor('a'.repeat(200))).toHaveLength(0);
  });

  it('rejects a UUID-shaped slug, which the public page would resolve as an id', async () => {
    const errors = await errorsFor('20069fca-e516-429f-a3bc-e88d80ce2021');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotUuidShaped');
  });

  it('applies the same rules on update (PartialType)', async () => {
    const dto = plainToInstance(UpdateProgramAnnouncementDto, { slug: 'Bad Slug' });
    expect((await validate(dto)).some((e) => e.property === 'slug')).toBe(true);
  });
});
