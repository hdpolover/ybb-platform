import { plainToInstance } from 'class-transformer';
import { UpdateApplicationRequestDto } from './update-application-request.dto';

/**
 * Same bug and same fix rationale as create-application-request.dto.spec.ts:
 * requirementFiles must survive class-transformer's implicit conversion via a
 * minimal passthrough, not a strict nested DTO, since this is the
 * participant-submit path.
 */
const TRANSFORM_OPTIONS = { enableImplicitConversion: true };

const sampleRequirementFiles = [
  { fileId: 'f1', fileName: 'passport.pdf', fileUrl: 'https://cdn.example.com/f1.pdf', mimeType: 'application/pdf', uploadedAt: '2026-07-01T00:00:00.000Z' },
];

describe('UpdateApplicationRequestDto.requirementFiles survives class-transformer with enableImplicitConversion', () => {
  it('keeps file object elements intact', () => {
    const dto = plainToInstance(
      UpdateApplicationRequestDto,
      { requirementFiles: sampleRequirementFiles },
      TRANSFORM_OPTIONS,
    );

    expect(dto.requirementFiles).toHaveLength(1);
    dto.requirementFiles?.forEach((item, i) => expect(item).toEqual(sampleRequirementFiles[i]));
  });

  it('still accepts an empty requirementFiles array', () => {
    const dto = plainToInstance(
      UpdateApplicationRequestDto,
      { requirementFiles: [] },
      TRANSFORM_OPTIONS,
    );

    expect(dto.requirementFiles).toEqual([]);
  });
});
