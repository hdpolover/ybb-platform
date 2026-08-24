// services/api/src/modules/programs/application/copy/template-payload.schemas.spec.ts
import { BadRequestException } from '@nestjs/common';
import { parseTemplateItems } from './template-payload.schemas';

describe('parseTemplateItems', () => {
  it('throws BadRequestException for an unregistered entityType', () => {
    expect(() => parseTemplateItems('not-a-real-key', [])).toThrow(BadRequestException);
  });

  it('form-fields: accepts a system-sourced item with only the thin shape (no label/type/options)', () => {
    const items = parseTemplateItems('form-fields', [
      { source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0 },
    ]);
    expect(items).toHaveLength(1);
  });

  it('form-fields: accepts a custom-sourced item with the full resolved shape', () => {
    const items = parseTemplateItems('form-fields', [
      {
        source: 'custom',
        name: 'tshirt_size',
        label: 'T-Shirt Size',
        type: 'select',
        placeholder: null,
        helpText: null,
        options: [{ label: 'M', value: 'm' }],
        validationRules: {},
        section: 'miscellaneous',
        isRequired: false,
        order: 1,
      },
    ]);
    expect(items).toHaveLength(1);
  });

  it('form-fields: accepts a migrated legacy item carrying labelOverride/helpTextOverride', () => {
    const items = parseTemplateItems('form-fields', [
      {
        source: 'system',
        systemFieldKey: 'full_name',
        name: null,
        label: null,
        type: null,
        placeholder: null,
        helpText: null,
        options: [],
        validationRules: {},
        section: 'personal_details',
        isRequired: true,
        order: 0,
        labelOverride: 'Legal Name',
        helpTextOverride: null,
      },
    ]);
    expect(items).toHaveLength(1);
  });

  it('form-fields: rejects an item missing source', () => {
    expect(() => parseTemplateItems('form-fields', [{ section: 'personal_details', isRequired: true, order: 0 }])).toThrow(
      BadRequestException,
    );
  });

  it('participation-categories: accepts the row shape and rejects a missing name', () => {
    const items = parseTemplateItems('participation-categories', [
      { name: 'High School', description: null, benefits: null, eligibility: null, isActive: true },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('participation-categories', [{ description: null }])).toThrow(BadRequestException);
  });

  it('timelines: accepts the row shape and rejects a non-ISO date', () => {
    const items = parseTemplateItems('timelines', [
      {
        date: '2027-01-01T00:00:00.000Z',
        endDate: null,
        title: 'Kickoff',
        description: null,
        icon: null,
        type: 'milestone',
        completionType: 'manual',
        completionConfig: {},
        targetAudience: 'all',
        isActive: true,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('timelines', [{ date: 'not-a-date', title: 'x' }])).toThrow(BadRequestException);
  });

  it('rundowns: requires day and activity', () => {
    const items = parseTemplateItems('rundowns', [
      { day: 'Day 1', startTime: null, endTime: null, activity: 'Registration', description: null, location: null, speaker: null, isActive: true },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('rundowns', [{ day: 'Day 1' }])).toThrow(BadRequestException);
  });

  it('faqs: requires question and answer', () => {
    const items = parseTemplateItems('faqs', [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('faqs', [{ question: 'Q?' }])).toThrow(BadRequestException);
  });

  it('payments: requires a name, a numeric price, and validates nested validityPeriods', () => {
    const items = parseTemplateItems('payments', [
      {
        name: 'Early Bird',
        description: null,
        price: 100,
        currency: 'USD',
        usdPrice: 100,
        idrPrice: 1500000,
        capacity: null,
        benefits: [],
        requirements: [],
        feeType: 'registration_fee',
        allowedCategories: ['self_funded'],
        icon: null,
        isActive: true,
        validityPeriods: [{ startDate: '2027-01-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z', description: 'Wave 1' }],
      },
    ]);
    expect(items).toHaveLength(1);
    expect(() =>
      parseTemplateItems('payments', [{ name: 'Early Bird', price: 'not-a-number', validityPeriods: [] }]),
    ).toThrow(BadRequestException);
  });

  it('program-details: requires the three scalar fields to be present (string or null)', () => {
    const items = parseTemplateItems('program-details', [
      { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: null },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('program-details', [{ requirementsDescription: 1 }])).toThrow(BadRequestException);
  });
});
