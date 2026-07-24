import { plainToInstance } from 'class-transformer';
import { CreateApplicationRequestDto } from './create-application-request.dto';

/**
 * requirementFiles has no @Type() and is declared DocumentFile[] (an
 * interface, so design:type reflects as Array with no element constructor).
 * Under the global ValidationPipe (transform: true, enableImplicitConversion: true),
 * class-transformer rebuilds every element as `new Array()`, silently
 * destroying the file metadata. This is the participant-submit path — a
 * platform-wide submit outage happened before from tightening validation
 * here, so the fix here is a minimal passthrough, NOT a strict nested DTO.
 * The set of accepted payloads must stay exactly what it is today.
 */
const TRANSFORM_OPTIONS = { enableImplicitConversion: true };

const sampleRequirementFiles = [
  { fileId: 'f1', fileName: 'passport.pdf', fileUrl: 'https://cdn.example.com/f1.pdf', mimeType: 'application/pdf', uploadedAt: '2026-07-01T00:00:00.000Z' },
  { fileId: 'f2', fileName: 'photo.jpg', fileUrl: 'https://cdn.example.com/f2.jpg' },
];

const basePayload = {
  participantId: '11111111-1111-1111-1111-111111111111',
  programId: '22222222-2222-2222-2222-222222222222',
};

describe('CreateApplicationRequestDto.requirementFiles survives class-transformer with enableImplicitConversion', () => {
  it('keeps file object elements intact', () => {
    const dto = plainToInstance(
      CreateApplicationRequestDto,
      { ...basePayload, requirementFiles: sampleRequirementFiles },
      TRANSFORM_OPTIONS,
    );

    expect(dto.requirementFiles).toHaveLength(2);
    dto.requirementFiles?.forEach((item, i) => expect(item).toEqual(sampleRequirementFiles[i]));
  });

  it('still accepts a minimal file object missing optional mimeType/uploadedAt (payload valid today)', () => {
    const minimal = [{ fileId: 'f3', fileName: 'cv.pdf', fileUrl: 'https://cdn.example.com/f3.pdf' }];
    const dto = plainToInstance(
      CreateApplicationRequestDto,
      { ...basePayload, requirementFiles: minimal },
      TRANSFORM_OPTIONS,
    );

    expect(dto.requirementFiles).toEqual(minimal);
  });

  it('still accepts an empty requirementFiles array (the shape held by all 12,538 prod rows today)', () => {
    const dto = plainToInstance(
      CreateApplicationRequestDto,
      { ...basePayload, requirementFiles: [] },
      TRANSFORM_OPTIONS,
    );

    expect(dto.requirementFiles).toEqual([]);
  });

  it('still accepts a request with requirementFiles omitted entirely', () => {
    const dto = plainToInstance(
      CreateApplicationRequestDto,
      { ...basePayload },
      TRANSFORM_OPTIONS,
    );

    expect(dto.requirementFiles).toBeUndefined();
  });
});
