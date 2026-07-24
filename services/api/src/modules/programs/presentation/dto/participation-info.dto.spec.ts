import { plainToInstance } from 'class-transformer';
import { CreateParticipationInfoDto, UpdateParticipationInfoDto } from './participation-info.dto';

/**
 * Reproduces the same prod-class prod bug as create-update-program-content.dto.spec.ts:
 * without an element type (or a passthrough transform) on an array property,
 * class-transformer's implicit conversion (main.ts ValidationPipe transformOptions)
 * rebuilds every OBJECT element as `new Array()`, silently destroying it.
 *
 * benefits/requirements/sections have no @Type() and no @Transform(), so any object
 * elements posted today would be shredded on write. Note: production data for
 * benefits/requirements (seed-programs-jys.ts, seed-programs-cys.ts, seed-programs-iys.ts)
 * is plain string arrays, which the bug does not corrupt (primitives pass through).
 * sections has no producer at all and is documented in participation.prisma as
 * "Generic sections for flexibility (Hero, Features, Steps, etc)" — intentionally
 * polymorphic, so this test exercises the object-element case preventively.
 */
const TRANSFORM_OPTIONS = { enableImplicitConversion: true };

const sampleObjectItems = [
  { title: 'Flight Ticket', description: 'Round trip economy class' },
  { title: 'Accommodation', description: '4-star hotel, 4 nights' },
];

const sampleStringItems = ['Flight Ticket', 'Accommodation', 'All Meals'];

describe('CreateParticipationInfoDto array fields survive class-transformer with enableImplicitConversion', () => {
  it('keeps benefits object elements intact', () => {
    const dto = plainToInstance(
      CreateParticipationInfoDto,
      { category: 'fully_funded', benefits: sampleObjectItems },
      TRANSFORM_OPTIONS,
    );

    expect(dto.benefits).toHaveLength(2);
    dto.benefits?.forEach((item, i) => expect(item).toEqual(sampleObjectItems[i]));
  });

  it('keeps requirements object elements intact', () => {
    const dto = plainToInstance(
      CreateParticipationInfoDto,
      { category: 'fully_funded', requirements: sampleObjectItems },
      TRANSFORM_OPTIONS,
    );

    expect(dto.requirements).toHaveLength(2);
    dto.requirements?.forEach((item, i) => expect(item).toEqual(sampleObjectItems[i]));
  });

  it('keeps sections object elements intact', () => {
    const dto = plainToInstance(
      CreateParticipationInfoDto,
      { category: 'fully_funded', sections: sampleObjectItems },
      TRANSFORM_OPTIONS,
    );

    expect(dto.sections).toHaveLength(2);
    dto.sections?.forEach((item, i) => expect(item).toEqual(sampleObjectItems[i]));
  });

  it('still accepts today\'s real-world plain string benefits/requirements (seed data shape)', () => {
    const dto = plainToInstance(
      CreateParticipationInfoDto,
      { category: 'fully_funded', benefits: sampleStringItems, requirements: sampleStringItems },
      TRANSFORM_OPTIONS,
    );

    expect(dto.benefits).toEqual(sampleStringItems);
    expect(dto.requirements).toEqual(sampleStringItems);
  });
});

describe('UpdateParticipationInfoDto array fields survive class-transformer with enableImplicitConversion', () => {
  it('keeps benefits/requirements/sections object elements intact', () => {
    const dto = plainToInstance(
      UpdateParticipationInfoDto,
      { benefits: sampleObjectItems, requirements: sampleObjectItems, sections: sampleObjectItems },
      TRANSFORM_OPTIONS,
    );

    expect(dto.benefits).toHaveLength(2);
    expect(dto.requirements).toHaveLength(2);
    expect(dto.sections).toHaveLength(2);
    dto.benefits?.forEach((item, i) => expect(item).toEqual(sampleObjectItems[i]));
    dto.requirements?.forEach((item, i) => expect(item).toEqual(sampleObjectItems[i]));
    dto.sections?.forEach((item, i) => expect(item).toEqual(sampleObjectItems[i]));
  });
});
