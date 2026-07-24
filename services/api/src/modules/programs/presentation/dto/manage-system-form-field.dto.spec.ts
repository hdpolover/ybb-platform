import { plainToInstance } from 'class-transformer';
import { CreateSystemFormFieldDto, UpdateSystemFormFieldDto } from './manage-system-form-field.dto';

/**
 * defaultOptions has no @Type()/@Transform() and is declared `unknown[]`.
 * Under the global ValidationPipe (transform: true, enableImplicitConversion: true),
 * class-transformer reads design:type as Array, has no element type to
 * construct, and rebuilds every OBJECT element as `new Array()`. Element
 * count survives, contents do not.
 *
 * Element shape evidenced directly by the live producer:
 * SystemFieldFormModal.tsx always sends `{ label, value }` objects
 * (`cleanedOptions = options.map((o) => ({ label: o.label.trim(), value: ... }))`).
 * Legacy plain strings are also tolerated (see get-application-form-fields.handler.ts
 * normalizeOptions(), which reads real historical rows of this same shape family).
 */
const TRANSFORM_OPTIONS = { enableImplicitConversion: true };

const sampleObjectOptions = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
];

const sampleStringOptions = ['Small', 'Medium'];

describe('CreateSystemFormFieldDto.defaultOptions survives class-transformer with enableImplicitConversion', () => {
  it('keeps object option elements intact', () => {
    const dto = plainToInstance(
      CreateSystemFormFieldDto,
      { key: 'tshirt_size', label: 'T-Shirt Size', category: 'logistics', type: 'select', defaultOptions: sampleObjectOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.defaultOptions).toHaveLength(2);
    (dto.defaultOptions as unknown[])?.forEach((item, i) => expect(item).toEqual(sampleObjectOptions[i]));
  });

  it('still accepts legacy plain-string option elements', () => {
    const dto = plainToInstance(
      CreateSystemFormFieldDto,
      { key: 'tshirt_size', label: 'T-Shirt Size', category: 'logistics', type: 'select', defaultOptions: sampleStringOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.defaultOptions).toEqual(sampleStringOptions);
  });
});

describe('UpdateSystemFormFieldDto.defaultOptions survives class-transformer with enableImplicitConversion', () => {
  it('keeps object option elements intact', () => {
    const dto = plainToInstance(
      UpdateSystemFormFieldDto,
      { defaultOptions: sampleObjectOptions },
      TRANSFORM_OPTIONS,
    );

    expect(dto.defaultOptions).toHaveLength(2);
    (dto.defaultOptions as unknown[])?.forEach((item, i) => expect(item).toEqual(sampleObjectOptions[i]));
  });
});
