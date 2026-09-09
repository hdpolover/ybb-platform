import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateParticipantProfileDto } from './participant.dto';

describe('UpdateParticipantProfileDto phone fields MaxLength(25)', () => {
  it('accepts phoneNumber/emergencyContactPhone exactly at the 25-char limit', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, {
      phoneNumber: '1'.repeat(25),
      emergencyContactPhone: '2'.repeat(25),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a phoneNumber over the 25-char limit (real overflowing input: two numbers pasted together)', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, {
      phoneNumber: '081234567890 / 081298765432 (alt number)',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
  });

  it('rejects an emergencyContactPhone over the 25-char limit', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, {
      emergencyContactPhone: '081234567890 / 081298765432 (alt number)',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emergencyContactPhone')).toBe(true);
  });
});

// Audit M99: this DTO is written wholesale (`{ ...updateDto }`,
// update-participant-profile.handler.ts:37) with no length guard on any of
// these fields, so an oversized value reached Postgres as an unnamed
// 22001/500 instead of a named 400. On the pre-fix DTO, each of these
// `validate()` calls resolves with zero errors for the offending field.
describe('UpdateParticipantProfileDto - M99 VarChar overflow guards', () => {
  it('rejects a fullName longer than 255 characters (participants.full_name VarChar(255))', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, { fullName: 'A'.repeat(256) });
    const errors = await validate(dto);

    const error = errors.find((e) => e.property === 'fullName');
    expect(error).toBeDefined();
    expect(error?.constraints).toHaveProperty('maxLength');
  });

  it('rejects a nickName longer than 100 characters (participants.nick_name VarChar(100))', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, { nickName: 'A'.repeat(101) });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'nickName')).toBeDefined();
  });

  it('rejects a displayName longer than 100 characters (participants.display_name VarChar(100))', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, { displayName: 'A'.repeat(101) });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'displayName')).toBeDefined();
  });

  it('rejects a nationality longer than 100 characters', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, { nationality: 'A'.repeat(101) });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'nationality')).toBeDefined();
  });

  it('rejects currentCity/currentCountry longer than 100 characters', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, {
      currentCity: 'A'.repeat(101),
      currentCountry: 'A'.repeat(101),
    });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'currentCity')).toBeDefined();
    expect(errors.find((e) => e.property === 'currentCountry')).toBeDefined();
  });

  it('accepts fullName/nickName/displayName exactly at their column limits', async () => {
    const dto = plainToInstance(UpdateParticipantProfileDto, {
      fullName: 'A'.repeat(255),
      nickName: 'B'.repeat(100),
      displayName: 'C'.repeat(100),
    });
    const errors = await validate(dto);

    expect(errors.find((e) => ['fullName', 'nickName', 'displayName'].includes(e.property))).toBeUndefined();
  });
});
