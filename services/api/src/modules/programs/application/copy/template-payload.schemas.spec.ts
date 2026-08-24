// services/api/src/modules/programs/application/copy/template-payload.schemas.spec.ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  it('form-fields: preserves mediaUrl/mediaAlt/helpAssets instead of silently stripping them', () => {
    // copy()'s own fields() callback (form-fields.copier.ts) copies these
    // three verbatim regardless of source — a schema with no slot for them
    // would silently drop media on every template apply.
    const items = parseTemplateItems('form-fields', [
      {
        source: 'custom',
        name: 'headshot',
        label: 'Headshot',
        type: 'file',
        placeholder: null,
        helpText: 'Upload a recent photo',
        options: [],
        validationRules: {},
        section: 'miscellaneous',
        isRequired: false,
        order: 2,
        mediaUrl: 'https://storage.example.com/example.png',
        mediaAlt: 'Example headshot',
        helpAssets: [{ url: 'https://storage.example.com/help.pdf' }],
      },
    ]);
    expect(items[0].mediaUrl).toBe('https://storage.example.com/example.png');
    expect(items[0].mediaAlt).toBe('Example headshot');
    expect(items[0].helpAssets).toEqual([{ url: 'https://storage.example.com/help.pdf' }]);
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
        // 'custom' is a real TimelineType member (enums.prisma) — the
        // original fixture used 'milestone', which isn't. That only
        // surfaced once `type` became z.enum()-constrained instead of a
        // bare z.string() (see the enum-rejection tests below).
        type: 'custom',
        completionType: 'manual',
        completionConfig: {},
        targetAudience: 'all',
        isActive: true,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('timelines', [{ date: 'not-a-date', title: 'x' }])).toThrow(BadRequestException);
  });

  it('timelines: accepts real Date instances for date/endDate, normalizing them to ISO strings', () => {
    // Straight off a Prisma row (TimelineRow.date/endDate are typed `Date`,
    // not `string`) — this is the exact shape exportTemplate hands in
    // before parseTemplateItems runs, before any JSON round-trip.
    const items = parseTemplateItems('timelines', [
      {
        date: new Date('2027-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-02T00:00:00.000Z'),
        title: 'Kickoff',
        description: null,
        icon: null,
        type: 'custom',
        completionType: 'manual',
        completionConfig: {},
        targetAudience: 'all',
        isActive: true,
      },
    ]);
    expect(items[0].date).toBe('2027-01-01T00:00:00.000Z');
    expect(items[0].endDate).toBe('2027-01-02T00:00:00.000Z');
  });

  it('timelines: rejects invalid type/completionType/targetAudience values instead of accepting any string', () => {
    const base = {
      date: '2027-01-01T00:00:00.000Z',
      endDate: null,
      title: 'Kickoff',
      description: null,
      icon: null,
      type: 'custom',
      completionType: 'manual',
      completionConfig: {},
      targetAudience: 'all',
      isActive: true,
    };
    expect(() => parseTemplateItems('timelines', [{ ...base, type: 'not-a-real-type' }])).toThrow(BadRequestException);
    expect(() => parseTemplateItems('timelines', [{ ...base, completionType: 'not-a-real-completion-type' }])).toThrow(
      BadRequestException,
    );
    expect(() => parseTemplateItems('timelines', [{ ...base, targetAudience: 'not-a-real-audience' }])).toThrow(
      BadRequestException,
    );
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

  it('faqs: rejects an invalid category instead of accepting any string', () => {
    expect(() =>
      parseTemplateItems('faqs', [{ question: 'Q?', answer: 'A.', category: 'not-a-real-category', isActive: true }]),
    ).toThrow(BadRequestException);
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

  it('payments: accepts real Prisma.Decimal price/usdPrice/idrPrice and real Date validityPeriod bounds, normalizing both', () => {
    // ProgramPricingTier.price/usdPrice/idrPrice are Prisma Decimal columns
    // and PricingTierValidityPeriod.startDate/endDate are Prisma DateTime
    // columns — straight off a row, these are Prisma.Decimal and Date
    // instances, not JSON primitives. This is the exact shape
    // exportTemplate hands in before any JSON round-trip.
    const items = parseTemplateItems('payments', [
      {
        name: 'Early Bird',
        description: null,
        price: new Prisma.Decimal('55.00'),
        currency: 'USD',
        usdPrice: new Prisma.Decimal('55.00'),
        idrPrice: new Prisma.Decimal('850000'),
        capacity: null,
        benefits: [],
        requirements: [],
        feeType: 'registration_fee',
        allowedCategories: ['self_funded'],
        icon: null,
        isActive: true,
        validityPeriods: [
          {
            startDate: new Date('2027-01-01T00:00:00.000Z'),
            endDate: new Date('2027-02-01T00:00:00.000Z'),
            description: 'Wave 1',
          },
        ],
      },
    ]);
    expect(items[0].price).toBe(55);
    expect(items[0].usdPrice).toBe(55);
    expect(items[0].idrPrice).toBe(850000);
    const validityPeriods = items[0].validityPeriods as Array<{ startDate: unknown; endDate: unknown }>;
    expect(validityPeriods[0].startDate).toBe('2027-01-01T00:00:00.000Z');
    expect(validityPeriods[0].endDate).toBe('2027-02-01T00:00:00.000Z');
  });

  it('payments: rejects an invalid feeType and an invalid allowedCategories member instead of accepting any string', () => {
    const base = {
      name: 'Early Bird',
      description: null,
      price: 100,
      currency: 'USD',
      usdPrice: null,
      idrPrice: null,
      capacity: null,
      benefits: [],
      requirements: [],
      feeType: 'registration_fee',
      allowedCategories: ['self_funded'],
      icon: null,
      isActive: true,
      validityPeriods: [],
    };
    expect(() => parseTemplateItems('payments', [{ ...base, feeType: 'not-a-real-fee-type' }])).toThrow(BadRequestException);
    expect(() => parseTemplateItems('payments', [{ ...base, allowedCategories: ['not-a-real-category'] }])).toThrow(
      BadRequestException,
    );
  });

  it('program-details: requires the three scalar fields to be present (string or null)', () => {
    const items = parseTemplateItems('program-details', [
      { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: null },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('program-details', [{ requirementsDescription: 1 }])).toThrow(BadRequestException);
  });

  // Every schema is .strict() so a field an entityType's copier doesn't
  // recognize is a loud validation failure instead of a silent drop — the
  // form-fields media fields (mediaUrl/mediaAlt/helpAssets) were exactly
  // this defect before this schema gained slots for them. One minimal valid
  // item per registered entityType, each with one extra field it has no
  // slot for.
  describe('rejects an item carrying a field its schema has no slot for', () => {
    it.each<[string, Record<string, unknown>]>([
      ['form-fields', { source: 'system', section: 'personal_details', isRequired: true, order: 0 }],
      ['participation-categories', { name: 'High School', description: null, benefits: null, eligibility: null, isActive: true }],
      [
        'timelines',
        {
          date: '2027-01-01T00:00:00.000Z',
          endDate: null,
          title: 'Kickoff',
          description: null,
          icon: null,
          type: 'custom',
          completionType: 'manual',
          completionConfig: {},
          targetAudience: 'all',
          isActive: true,
        },
      ],
      [
        'rundowns',
        {
          day: 'Day 1',
          startTime: null,
          endTime: null,
          activity: 'Registration',
          description: null,
          location: null,
          speaker: null,
          isActive: true,
        },
      ],
      ['faqs', { question: 'Q?', answer: 'A.', category: 'general', isActive: true }],
      [
        'payments',
        {
          name: 'Early Bird',
          description: null,
          price: 100,
          currency: 'USD',
          usdPrice: null,
          idrPrice: null,
          capacity: null,
          benefits: [],
          requirements: [],
          feeType: 'registration_fee',
          allowedCategories: ['self_funded'],
          icon: null,
          isActive: true,
          validityPeriods: [],
        },
      ],
      ['program-details', { requirementsDescription: null, benefitsDescription: null, termsAndConditions: null }],
    ])('%s', (entityType, validItem) => {
      expect(() => parseTemplateItems(entityType, [{ ...validItem, unexpectedField: 'nope' }])).toThrow(BadRequestException);
    });
  });
});
