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
});
