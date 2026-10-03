// services/api/src/modules/portal/application/queries/handlers/get-portal-submission-detail.handler.incomplete-items.spec.ts
import { GetPortalSubmissionDetailHandler } from './get-portal-submission-detail.handler';

const formField = (name: string, isRequired: boolean, order: number) => ({
    id: `field-${name}`,
    section: 'personal_details',
    name,
    label: name,
    type: 'text',
    placeholder: null,
    helpText: null,
    mediaUrl: null,
    mediaAlt: null,
    helpAssets: [],
    options: [],
    validationRules: {},
    isRequired,
    order,
    allowedCategories: [],
});

interface ApplicationOverrides {
    personalData?: Record<string, unknown>;
    essayAnswers?: Record<string, unknown>;
    uploadedFiles?: Record<string, unknown>;
}

// Personal Details: two required fields among an optional one.
const makeApplication = ({ personalData = {}, essayAnswers = {}, uploadedFiles = {} }: ApplicationOverrides) => ({
    id: 'app-1',
    status: 'draft',
    applicationCategory: 'fully_funded',
    registrationPaymentStatus: 'paid',
    personalData,
    essayAnswers,
    uploadedFiles,
    invoices: [],
    program: {
        id: 'program-1',
        name: 'Test Program',
        applicationDeadline: null,
        previewChecklistItems: [],
        pricingTiers: [],
        participationCategories: [],
        subthemes: [],
        formFields: [
            formField('full_name', true, 1),
            formField('nickname', false, 2),
            formField('nationality', true, 3),
        ],
        essays: [
            { id: 'essay-1', question: 'Why do you want to join?', isRequired: true, wordLimit: null, order: 1, allowedCategories: [] },
            { id: 'essay-2', question: 'Anything else?', isRequired: false, wordLimit: null, order: 2, allowedCategories: [] },
        ],
        requirements: [
            { id: 'req-1', name: 'Passport', description: null, type: 'document', isRequired: true, order: 1 },
            { id: 'req-2', name: 'CV', description: null, type: 'document', isRequired: false, order: 2 },
        ],
    },
});

const COMPLETE: ApplicationOverrides = {
    personalData: { full_name: 'Jane Doe', nationality: 'ZA' },
    essayAnswers: { 'essay-1': 'Because.' },
    uploadedFiles: { 'req-1': { url: 'https://cdn.example/passport.pdf' } },
};

const setup = (overrides: ApplicationOverrides) => {
    const prisma = { participantApplication: { findFirst: jest.fn().mockResolvedValue(makeApplication(overrides)) } };
    const cacheService = { get: jest.fn(), set: jest.fn() };
    const portalCacheService = {
        getParticipantProfile: jest.fn().mockResolvedValue({ id: 'participant-1', user: { id: 'user-1' } }),
    };
    const handler = new GetPortalSubmissionDetailHandler(prisma as any, cacheService as any, portalCacheService as any);
    return { handler, prisma, cacheService, portalCacheService };
};

describe('GetPortalSubmissionDetailHandler.findIncompleteRequiredItems', () => {
    it('names the section when a required field is blank while optional ones are filled', async () => {
        const { handler } = setup({ ...COMPLETE, personalData: { full_name: 'Jane', nickname: 'T', nationality: '' } });

        const items = await handler.findIncompleteRequiredItems('user-1');

        expect(items).toEqual(['Complete Personal Details']);
    });

    it('reports missing required essays and documents with the same wording as the preview', async () => {
        const { handler } = setup({ ...COMPLETE, essayAnswers: {}, uploadedFiles: {} });

        const items = await handler.findIncompleteRequiredItems('user-1');

        expect(items).toEqual(['Complete 1 required essay', 'Upload 1 required document']);
    });

    it('returns an empty list when every required item is present', async () => {
        const { handler } = setup(COMPLETE);

        const items = await handler.findIncompleteRequiredItems('user-1');

        expect(items).toEqual([]);
    });

    it('never reads or writes the response cache', async () => {
        const { handler, cacheService } = setup(COMPLETE);

        await handler.findIncompleteRequiredItems('user-1');

        expect(cacheService.get).not.toHaveBeenCalled();
        expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('scopes the application lookup to the given programId', async () => {
        const { handler, prisma } = setup(COMPLETE);

        await handler.findIncompleteRequiredItems('user-1', 'program-42');

        expect(prisma.participantApplication.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ programId: 'program-42' }) }),
        );
    });
});
