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
});
