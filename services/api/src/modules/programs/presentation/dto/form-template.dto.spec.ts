import { plainToInstance } from 'class-transformer';
import { TemplateFieldInputDto } from './form-template.dto';

/**
 * TemplateFieldInputDto.options has no @Type()/@Transform() and is declared
 * `unknown[]`. Under the global ValidationPipe (transform: true,
 * enableImplicitConversion: true), class-transformer reads design:type as
 * Array, has no element type to construct, and rebuilds every OBJECT element
 * as `new Array()`. Element count survives, contents do not.
 *
 * Element shape evidenced by services/api's own read-side normalizer
 * (get-application-form-fields.handler.ts normalizeOptions()), which tolerates
 * both `{ label, value }` objects (the live write shape from
 * OptionsRepeater.tsx / SystemFieldFormModal.tsx) and legacy plain strings —
 * both of which are real, persisted shapes for this field family.
 */
const TRANSFORM_OPTIONS = { enableImplicitConversion: true };

const sampleObjectOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

const sampleStringOptions = ['Male', 'Female'];

describe('TemplateFieldInputDto.options survives class-transformer with enableImplicitConversion', () => {
  it('keeps object option elements intact', () => {
    const dto = plainToInstance(
      TemplateFieldInputDto,
      { source: 'custom', name: 'gender', label: 'Gender', type: 'select', options: sampleObjectOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.options).toHaveLength(2);
    (dto.options as unknown[])?.forEach((item, i) => expect(item).toEqual(sampleObjectOptions[i]));
  });

  it('still accepts legacy plain-string option elements', () => {
    const dto = plainToInstance(
      TemplateFieldInputDto,
      { source: 'custom', name: 'gender', label: 'Gender', type: 'select', options: sampleStringOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.options).toEqual(sampleStringOptions);
  });
});
