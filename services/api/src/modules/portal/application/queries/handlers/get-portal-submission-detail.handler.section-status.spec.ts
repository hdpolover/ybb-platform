// services/api/src/modules/portal/application/queries/handlers/get-portal-submission-detail.handler.section-status.spec.ts
import { GetPortalSubmissionDetailHandler } from './get-portal-submission-detail.handler';

type SectionResult = { id: string; status: string };

interface FieldFixture {
    name: string;
    type: string;
    isRequired: boolean;
}

const field = ({ name, type, isRequired }: FieldFixture, order: number) => ({
    id: `field-${name}`,
    section: 'personal_details',
    name,
    label: name,
    type,
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

// Mirrors the Personal Details section of a real program form: three required
// fields in among optional ones.
const PERSONAL_DETAILS_FIELDS: FieldFixture[] = [
    { name: 'full_name', type: 'text', isRequired: true },
    { name: 'nickname', type: 'text', isRequired: false },
    { name: 'birthdate', type: 'date', isRequired: false },
    { name: 'gender', type: 'select', isRequired: true },
    { name: 'nationality', type: 'text', isRequired: true },
    { name: 'origin_address', type: 'textarea', isRequired: false },
    { name: 'current_address', type: 'textarea', isRequired: false },
];

const buildSections = (personalData: Record<string, unknown>): SectionResult[] => {
    const handler = new GetPortalSubmissionDetailHandler({} as any, {} as any, {} as any);
    const application = {
        id: 'app-1',
        status: 'draft',
        applicationCategory: 'fully_funded',
        personalData,
        program: {
            id: 'program-1',
            formFields: PERSONAL_DETAILS_FIELDS.map(field),
            subthemes: [],
        },
    };

    return (handler as any).buildSections(application, {});
};

const personalDetailsStatus = (personalData: Record<string, unknown>): string | undefined =>
    buildSections(personalData).find((section) => section.id === 'personal_details')?.status;

describe('GetPortalSubmissionDetailHandler section status', () => {
    it('does not complete a section when optional answers outnumber the missing required field', () => {
        const status = personalDetailsStatus({
            full_name: 'Jane',
            nickname: '',
            birthdate: '2001-05-14',
            gender: 'female',
            nationality: '',
            origin_address: '12 Example Street',
            current_address: '12 Example Street',
        });

        expect(status).toBe('in_progress');
    });

    it('completes a section once every required field is filled, optional ones left blank', () => {
        const status = personalDetailsStatus({
            full_name: 'Jane Alexandra Doe',
            gender: 'female',
            nationality: 'ZA',
        });

        expect(status).toBe('completed');
    });

    it('treats a whitespace-only required answer as missing', () => {
        const status = personalDetailsStatus({
            full_name: 'Jane',
            gender: 'female',
            nationality: '   ',
            birthdate: '2001-05-14',
        });

        expect(status).toBe('in_progress');
    });

    it('leaves an untouched section pending', () => {
        expect(personalDetailsStatus({})).toBe('pending');
    });
});
