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
