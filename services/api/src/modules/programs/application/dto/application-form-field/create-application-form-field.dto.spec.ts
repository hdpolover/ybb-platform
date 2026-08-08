import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateApplicationFormFieldDto, FormFieldType } from './create-application-form-field.dto';
import { UpdateApplicationFormFieldDto } from './update-application-form-field.dto';

const basePayload = { label: 'Field label', fieldType: FormFieldType.TEXT };

describe('CreateApplicationFormFieldDto label/placeholder/mediaAlt MaxLength(255)', () => {
  it('accepts values exactly at the 255-char limit', async () => {
    const dto = plainToInstance(CreateApplicationFormFieldDto, {
      ...basePayload,
      label: 'a'.repeat(255),
      placeholder: 'b'.repeat(255),
      mediaAlt: 'c'.repeat(255),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a label over the 255-char limit', async () => {
    const dto = plainToInstance(CreateApplicationFormFieldDto, { ...basePayload, label: 'a'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'label')).toBe(true);
  });

  it('rejects a placeholder over the 255-char limit', async () => {
    const dto = plainToInstance(CreateApplicationFormFieldDto, { ...basePayload, placeholder: 'b'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'placeholder')).toBe(true);
  });

  it('rejects a mediaAlt over the 255-char limit', async () => {
    const dto = plainToInstance(CreateApplicationFormFieldDto, { ...basePayload, mediaAlt: 'c'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'mediaAlt')).toBe(true);
  });
});

describe('UpdateApplicationFormFieldDto (inherits MaxLength(255) via PartialType)', () => {
  it('rejects a label over the 255-char limit', async () => {
    const dto = plainToInstance(UpdateApplicationFormFieldDto, { label: 'a'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'label')).toBe(true);
  });
});
