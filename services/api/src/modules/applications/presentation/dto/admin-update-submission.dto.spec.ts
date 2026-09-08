// src/modules/applications/presentation/dto/admin-update-submission.dto.spec.ts
//
// M114: these fields had no length cap, so an overlong value reached Postgres and
// raised 22001. PR #139 already turns that into a 4xx rather than an opaque 500;
// the caps are what let the response NAME the offending field. Bounds mirror the
// columns exactly — participants.full_name VarChar(255),
// nick_name/display_name VarChar(100), twibbon_link VarChar(500).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminParticipantPatchDto, AdminApplicationPatchDto } from './admin-update-submission.dto';

// The fields sit on the NESTED patch DTOs, not the envelope — validating the
// envelope alone passes whatever they contain.
const errorsFor = async (field: string, value: string) =>
  field === 'twibbonLink'
    ? validate(plainToInstance(AdminApplicationPatchDto, { [field]: value }), {
        skipMissingProperties: true,
      })
    : validate(plainToInstance(AdminParticipantPatchDto, { [field]: value }), {
        skipMissingProperties: true,
      });

describe('AdminUpdateSubmissionDto — length caps match the columns', () => {
  it.each([
    ['fullName', 255],
    ['nickName', 100],
    ['displayName', 100],
    ['twibbonLink', 500],
  ])('rejects %s beyond %i characters, naming the field', async (field, max) => {
    // 'a' repeated keeps it valid for the English-name validators, so the only
    // thing under test is the length.
    const errors = await errorsFor(field, 'a'.repeat(max + 1));
    const onField = errors.find((e) => e.property === field);
    expect(onField).toBeDefined();
    expect(Object.keys(onField!.constraints ?? {})).toContain('maxLength');
  });

  it.each([
    ['fullName', 255],
    ['nickName', 100],
    ['displayName', 100],
    ['twibbonLink', 500],
  ])('accepts %s at exactly %i characters', async (field, max) => {
    const errors = await errorsFor(field, 'a'.repeat(max));
    expect(errors.find((e) => e.property === field)?.constraints?.maxLength).toBeUndefined();
  });
});
