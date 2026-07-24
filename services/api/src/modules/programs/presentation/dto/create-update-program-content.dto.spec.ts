import { plainToInstance } from 'class-transformer';
import {
  CreateProgramRequirementDto,
  UpdateProgramRequirementDto,
  CreateDocumentTemplateDto,
  UpdateDocumentTemplateDto,
  PreviewDocumentTemplateDto,
} from './create-update-program-content.dto';

/**
 * Reproduces a prod-class bug: `options` has no @Type()/@Transform() and is
 * declared as string[] | Record<string, unknown>[]. Under the global
 * ValidationPipe (transform: true, enableImplicitConversion: true), class-transformer
 * reads design:type as Array, has no element type to construct, and rebuilds
 * every OBJECT element as `new Array()`. Element count survives, contents do not.
 * String elements pass through untouched (class-transformer only reconstructs
 * object-shaped elements), which is why ProgramRequirement.options being
 * genuinely unused in production today does not make this untestable.
 *
 * The element shape is a union: `{ label, value }` objects (the shape shared
 * with the actively-used ApplicationFormTemplateField.options and
 * SystemFormFieldDefinition.defaultOptions sibling fields, same "choices for
 * select/checkbox" concept per the Prisma schema comment on ProgramRequirement.options)
 * and legacy plain strings.
 */
const TRANSFORM_OPTIONS = { enableImplicitConversion: true };

const sampleObjectOptions = [
  { label: 'Small', value: 'S' },
  { label: 'Medium', value: 'M' },
];

const sampleStringOptions = ['Small', 'Medium', 'Large'];

const baseCreatePayload = {
  programId: '11111111-1111-1111-1111-111111111111',
  name: 'T-Shirt Size',
  type: 'checkbox',
};

describe('CreateProgramRequirementDto.options survives class-transformer with enableImplicitConversion', () => {
  it('keeps object option elements intact', () => {
    const dto = plainToInstance(
      CreateProgramRequirementDto,
      { ...baseCreatePayload, options: sampleObjectOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.options).toHaveLength(2);
    (dto.options as unknown[])?.forEach((item, i) => expect(item).toEqual(sampleObjectOptions[i]));
  });

  it('still accepts legacy plain-string option elements', () => {
    const dto = plainToInstance(
      CreateProgramRequirementDto,
      { ...baseCreatePayload, options: sampleStringOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.options).toEqual(sampleStringOptions);
  });
});

describe('UpdateProgramRequirementDto.options survives class-transformer with enableImplicitConversion', () => {
  it('keeps object option elements intact', () => {
    const dto = plainToInstance(
      UpdateProgramRequirementDto,
      { options: sampleObjectOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.options).toHaveLength(2);
    (dto.options as unknown[])?.forEach((item, i) => expect(item).toEqual(sampleObjectOptions[i]));
  });

  it('still accepts legacy plain-string option elements', () => {
    const dto = plainToInstance(
      UpdateProgramRequirementDto,
      { options: sampleStringOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.options).toEqual(sampleStringOptions);
  });
});

/**
 * Reproduces a prod bug: without an element type on the `placeholders` array,
 * class-transformer's implicit conversion (main.ts ValidationPipe transformOptions)
 * rebuilds every element as `new Array()`, silently turning
 * [{key,label,source}, ...] into [[], [], ...] on write.
 */
const samplePlaceholders = [
    { key: '{{participant_name}}', label: 'Participant Full Name', source: 'participant.fullName' },
    { key: '{{program_name}}', label: 'Program Name', source: 'program.name' },
    { key: '{{acceptance_date}}', label: 'Acceptance Date', source: 'generated_at' },
];

describe('placeholders array survives class-transformer with enableImplicitConversion', () => {
    it('CreateDocumentTemplateDto keeps placeholder objects intact', () => {
        const dto = plainToInstance(
            CreateDocumentTemplateDto,
            {
                programId: '11111111-1111-1111-1111-111111111111',
                name: 'LOA Template',
                type: 'letter_of_acceptance',
                placeholders: samplePlaceholders,
            },
            TRANSFORM_OPTIONS,
        );

        expect(dto.placeholders).toHaveLength(3);
        dto.placeholders?.forEach((p, i) => {
            expect(p).toEqual(samplePlaceholders[i]);
        });
    });

    it('UpdateDocumentTemplateDto keeps placeholder objects intact', () => {
        const dto = plainToInstance(
            UpdateDocumentTemplateDto,
            { placeholders: samplePlaceholders },
            TRANSFORM_OPTIONS,
        );

        expect(dto.placeholders).toHaveLength(3);
        dto.placeholders?.forEach((p, i) => {
            expect(p).toEqual(samplePlaceholders[i]);
        });
    });

    it('PreviewDocumentTemplateDto keeps placeholder objects intact', () => {
        const dto = plainToInstance(
            PreviewDocumentTemplateDto,
            { htmlContent: '<p>{{participant_name}}</p>', placeholders: samplePlaceholders },
            TRANSFORM_OPTIONS,
        );

        expect(dto.placeholders).toHaveLength(3);
        dto.placeholders?.forEach((p, i) => {
            expect(p).toEqual(samplePlaceholders[i]);
        });
    });
});
