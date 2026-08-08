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
