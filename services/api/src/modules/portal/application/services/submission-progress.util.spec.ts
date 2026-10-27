import { calculateSubmissionProgress } from './submission-progress.util';

describe('calculateSubmissionProgress', () => {
    it('does not force 100% for non-draft applications with incomplete sections', () => {
        const progress = calculateSubmissionProgress({
            status: 'submitted',
            personalData: {
                full_name: 'Alice',
            },
            program: {
                id: 'program-1',
                formFields: [
                    { section: 'personal_details', name: 'full_name', isRequired: true },
                    { section: 'contact_information', name: 'phone_number', isRequired: true },
                ],
                essays: [],
                requirements: [],
            },
        });

        expect(progress).toBe(50);
    });

    it('returns 100% only when all required sections are completed', () => {
        const progress = calculateSubmissionProgress({
            status: 'submitted',
            personalData: {
                full_name: 'Alice',
                phone_number: '+6200000',
            },
            program: {
                id: 'program-1',
                formFields: [
                    { section: 'personal_details', name: 'full_name', isRequired: true },
                    { section: 'contact_information', name: 'phone_number', isRequired: true },
                ],
                essays: [],
                requirements: [],
            },
        });

        expect(progress).toBe(100);
    });

    it('reaches 100% for a Self Funded applicant when only Fully Funded-scoped essays are outstanding', () => {
        const progress = calculateSubmissionProgress({
            status: 'submitted',
            applicationCategory: 'self_funded',
            personalData: { full_name: 'Alice' },
            essayAnswers: {},
            program: {
                id: 'program-1',
                formFields: [{ section: 'personal_details', name: 'full_name', isRequired: true }],
                essays: [
                    { id: 'essay-ff', isRequired: true, allowedCategories: ['fully_funded'] },
                ],
                requirements: [],
            },
        });

        expect(progress).toBe(100);
    });

    it('still requires Fully Funded-scoped essays for a Fully Funded applicant', () => {
        const progress = calculateSubmissionProgress({
            status: 'submitted',
            applicationCategory: 'fully_funded',
            personalData: { full_name: 'Alice' },
            essayAnswers: {},
            program: {
                id: 'program-1',
                formFields: [{ section: 'personal_details', name: 'full_name', isRequired: true }],
                essays: [
                    { id: 'essay-ff', isRequired: true, allowedCategories: ['fully_funded'] },
                ],
                requirements: [],
            },
        });

        expect(progress).toBe(50);
    });

    it('ignores a required field hidden by visibleWhen, but counts it once the rule matches', () => {
        const program = {
            id: 'program-1',
            formFields: [
                { section: 'personal_details', name: 'is_alumni', isRequired: true },
                {
                    section: 'professional_profile',
                    name: 'alumni_program',
                    isRequired: true,
                    validationRules: { visibleWhen: { field: 'is_alumni', equals: 'Yes' } },
                },
            ],
            essays: [],
            requirements: [],
        };

        const hidden = calculateSubmissionProgress({ status: 'draft', personalData: { is_alumni: 'No' }, program });
        const shown = calculateSubmissionProgress({ status: 'draft', personalData: { is_alumni: 'Yes' }, program });

        expect(hidden).toBe(100);
        expect(shown).toBe(50);
    });

    it('does not hide a required field because of a personalData key whose controller is not in the form', () => {
        const progress = calculateSubmissionProgress({
            status: 'draft',
            personalData: { ghost_flag: 'No' },
            program: {
                id: 'program-1',
                formFields: [
                    {
                        section: 'personal_details',
                        name: 'alumni_program',
                        isRequired: true,
                        validationRules: { visibleWhen: { field: 'ghost_flag', equals: 'Yes' } },
                    },
                ],
                essays: [],
                requirements: [],
            },
        });

        expect(progress).toBe(0);
    });
});
