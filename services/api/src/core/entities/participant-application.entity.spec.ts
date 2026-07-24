import { ParticipantApplication, ApplicationStatus } from './participant-application.entity';

/**
 * Prod bug: submittedAt was declared readonly and never assigned inside submit(),
 * so the admin/manual submit path persisted submission_date as NULL, leaving
 * paid+submitted applications permanently ineligible for their Invitation Letter
 * (LoaEligibilityService hard-fails on a null submittedAt).
 */
const makeDraftApplication = (): ParticipantApplication =>
    new ParticipantApplication(
        'app-1',
        'participant-1',
        'program-1',
        ApplicationStatus.DRAFT,
    );

describe('ParticipantApplication.submit()', () => {
    it('stamps submittedAt with a Date when the application is in a submittable state', () => {
        const application = makeDraftApplication();
        expect(application.submittedAt).toBeUndefined();

        application.submit();

        expect(application.status).toBe(ApplicationStatus.SUBMITTED);
        expect(application.submittedAt).toBeInstanceOf(Date);
    });

    it('throws and leaves submittedAt untouched when submitted from a non-submittable status', () => {
        const application = new ParticipantApplication(
            'app-2',
            'participant-2',
            'program-2',
            ApplicationStatus.UNDER_REVIEW,
        );

        expect(() => application.submit()).toThrow(
            `Cannot submit application in ${ApplicationStatus.UNDER_REVIEW} status`,
        );

        expect(application.status).toBe(ApplicationStatus.UNDER_REVIEW);
        expect(application.submittedAt).toBeUndefined();
    });
});
