import { ParticipantApplication, ApplicationStatus } from './participant-application.entity';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';

/**
 * Two instances of the same defect shape, a year apart.
 *
 * Prod bug: submittedAt was declared readonly and never assigned inside submit(),
 * so the admin/manual submit path persisted submission_date as NULL, leaving
 * paid+submitted applications permanently ineligible for their Invitation Letter
 * (LoaEligibilityService hard-fails on a null submittedAt).
 *
 * Audit M178: withdrawnAt/withdrawnBy were declared readonly and never assigned
 * inside withdraw(), so every withdrawn application carried NULL audit columns and
 * currentApplicationOrderBy's `withdrawnAt nulls first` rule could not tell a live
 * application from a withdrawn one.
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

const makeWithdrawableApplication = (): ParticipantApplication =>
    new ParticipantApplication(
        'app-3',
        'participant-3',
        'program-3',
        ApplicationStatus.SUBMITTED,
    );

describe('ParticipantApplication.withdraw()', () => {
    it('stamps withdrawnAt and withdrawnBy with the acting user', () => {
        const application = makeWithdrawableApplication();
        expect(application.withdrawnAt).toBeUndefined();
        expect(application.withdrawnBy).toBeUndefined();

        application.withdraw('admin-user-1');

        expect(application.status).toBe(ApplicationStatus.WITHDRAWN);
        expect(application.withdrawnAt).toBeInstanceOf(Date);
        expect(application.withdrawnBy).toBe('admin-user-1');
    });

    it('throws and leaves the audit columns untouched when withdrawn from a non-withdrawable status', () => {
        const application = new ParticipantApplication(
            'app-4',
            'participant-4',
            'program-4',
            ApplicationStatus.DRAFT,
        );

        expect(() => application.withdraw('admin-user-1')).toThrow(
            `Cannot withdraw application in ${ApplicationStatus.DRAFT} status`,
        );

        expect(application.status).toBe(ApplicationStatus.DRAFT);
        expect(application.withdrawnAt).toBeUndefined();
        expect(application.withdrawnBy).toBeUndefined();
    });

    it('carries the stamped audit columns through the persistence payload', () => {
        const application = makeWithdrawableApplication();

        application.withdraw('admin-user-1');
        const payload = new ApplicationMapper().toPrismaUpdate(application);

        expect(payload.withdrawnAt).toBe(application.withdrawnAt);
        expect(payload.withdrawnBy).toBe('admin-user-1');
    });
});
