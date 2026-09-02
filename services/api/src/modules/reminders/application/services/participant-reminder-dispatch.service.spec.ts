// src/modules/reminders/application/services/participant-reminder-dispatch.service.spec.ts
import { ParticipantReminderDispatchService } from './participant-reminder-dispatch.service';
import { ParticipantReminderRepository } from '../../infrastructure/persistence/participant-reminder.repository';
import { ParticipantReminderSendRepository } from '../../infrastructure/persistence/participant-reminder-send.repository';
import { RegistrationFeeAudienceService } from './registration-fee-audience.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

const RECIPIENTS = [
  { participantId: 'p-1', userId: 'u-1', email: 'ada@example.com', fullName: 'Ada' },
  { participantId: 'p-2', userId: 'u-2', email: 'bob@example.com', fullName: 'Bob' },
];

const REMINDER = {
  id: 'rem-1',
  programId: 'prog-1',
  audience: 'registration_fee_unpaid',
  subject: 'Registration fee for {{program_name}}',
  body: 'Hi {{participant_name}}, please pay.',
  scheduledAt: new Date('2026-09-09T01:00:00.000Z'),
  status: 'sending',
  dispatchedAt: new Date(),
  sentAt: null,
  cancelledAt: null,
  audienceCount: null,
  createdAt: new Date(),
};

function build(over: {
  claim?: jest.Mock;
  recipients?: typeof RECIPIENTS;
  emit?: jest.Mock;
} = {}) {
  const claimForSending = over.claim ?? jest.fn().mockResolvedValue(REMINDER);
  const markSent = jest.fn().mockResolvedValue(undefined);
  const findDueIds = jest.fn().mockResolvedValue(['rem-1']);
  const markPending = jest.fn().mockResolvedValue(undefined);
  const emit = over.emit ?? jest.fn().mockResolvedValue(undefined);
  const findRecipients = jest
    .fn()
    .mockResolvedValue(over.recipients ?? RECIPIENTS);

  const service = new ParticipantReminderDispatchService(
    {
      program: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'China Youth Summit 2026',
          brandId: 'brand-1',
          brand: {
            name: 'China Youth Summit',
            websiteUrl: 'https://cys.example.com',
            landingUrl: 'https://cys.example.com',
          },
        }),
      },
    } as unknown as PrismaService,
    { claimForSending, markSent, findDueIds } as unknown as ParticipantReminderRepository,
    { markPending } as unknown as ParticipantReminderSendRepository,
    { findRecipients } as unknown as RegistrationFeeAudienceService,
    { emit } as unknown as RabbitMQProducerService,
  );

  return { service, claimForSending, markSent, findDueIds, markPending, emit, findRecipients };
}

describe('ParticipantReminderDispatchService', () => {
  describe('idempotency', () => {
    it('claims the reminder with a status-guarded update before doing anything else', async () => {
      const { service, claimForSending, findRecipients, emit } = build();

      await service.dispatchOne('rem-1');

      // The claim is the whole guarantee: a single UPDATE ... WHERE status =
      // 'scheduled' is atomic, so only one caller can ever get past it.
      expect(claimForSending).toHaveBeenCalledWith('rem-1');
      expect(claimForSending.mock.invocationCallOrder[0]).toBeLessThan(
        findRecipients.mock.invocationCallOrder[0],
      );
      expect(claimForSending.mock.invocationCallOrder[0]).toBeLessThan(
        emit.mock.invocationCallOrder[0],
      );
    });

    it('sends nothing when the claim is lost to a concurrent dispatcher', async () => {
      const { service, emit, markPending, markSent, findRecipients } = build({
        claim: jest.fn().mockResolvedValue(null),
      });

      const outcome = await service.dispatchOne('rem-1');

      expect(outcome).toEqual({
        reminderId: 'rem-1',
        result: 'not_claimed',
        recipientCount: 0,
      });
      expect(findRecipients).not.toHaveBeenCalled();
      expect(markPending).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
      expect(markSent).not.toHaveBeenCalled();
    });

    it('emits exactly once even when the same reminder is dispatched twice', async () => {
      // Second call models a duplicate scheduler tick or a second replica: the
      // conditional update matches nothing because the row is no longer
      // `scheduled`.
      const claim = jest
        .fn()
        .mockResolvedValueOnce(REMINDER)
        .mockResolvedValueOnce(null);
      const { service, emit } = build({ claim });

      await service.dispatchOne('rem-1');
      await service.dispatchOne('rem-1');

      expect(emit).toHaveBeenCalledTimes(1);
    });

    it('never re-claims a reminder left in `sending` by a crashed process', async () => {
      const { service, findDueIds } = build();

      await service.dispatchDue(new Date('2026-09-09T02:00:00.000Z'));

      // findDueIds only ever selects `scheduled` rows (see the repository), so
      // a half-sent reminder is not retried. At-most-once, deliberately.
      expect(findDueIds).toHaveBeenCalledWith(
        new Date('2026-09-09T02:00:00.000Z'),
        expect.any(Number),
      );
    });
  });

  describe('ordering', () => {
    it('writes pending send rows before publishing the event', async () => {
      const { service, markPending, emit } = build();

      await service.dispatchOne('rem-1');

      expect(markPending).toHaveBeenCalledWith('rem-1', 'prog-1', RECIPIENTS);
      expect(markPending.mock.invocationCallOrder[0]).toBeLessThan(
        emit.mock.invocationCallOrder[0],
      );
    });

    it('publishes the subject and body once as templates, not pre-rendered per recipient', async () => {
      const { service, emit } = build();

      await service.dispatchOne('rem-1');

      const [routingKey, payload] = emit.mock.calls[0];
      expect(routingKey).toBe('reminder.participant.dispatch');
      expect(payload).toMatchObject({
        reminderId: 'rem-1',
        programId: 'prog-1',
        programName: 'China Youth Summit 2026',
        subject: 'Registration fee for {{program_name}}',
        body: 'Hi {{participant_name}}, please pay.',
        paymentsUrl: 'https://cys.example.com/dashboard/payments',
        recipients: RECIPIENTS,
      });
    });
  });

  describe('empty audience', () => {
    it('records the run and sends nothing rather than erroring', async () => {
      const { service, emit, markPending, markSent } = build({ recipients: [] });

      const outcome = await service.dispatchOne('rem-1');

      expect(outcome).toEqual({
        reminderId: 'rem-1',
        result: 'empty_audience',
        recipientCount: 0,
      });
      expect(emit).not.toHaveBeenCalled();
      expect(markPending).not.toHaveBeenCalled();
      // audienceCount 0 is a recorded outcome, not a missing one.
      expect(markSent).toHaveBeenCalledWith('rem-1', 0);
    });
  });

  describe('error handling', () => {
    it('does not roll the reminder back to `scheduled` when the publish fails', async () => {
      const { service, markSent } = build({
        emit: jest.fn().mockRejectedValue(new Error('broker down')),
      });

      await expect(service.dispatchOne('rem-1')).resolves.toMatchObject({
        result: 'sent',
      });
      // Retrying a publish that may in fact have landed is how you mail
      // everyone twice. The pending rows stay pending: "outcome unknown".
      expect(markSent).toHaveBeenCalledWith('rem-1', 2);
    });

    it('still sends when the pending-row audit write fails', async () => {
      const { service } = build();
      const markPending = jest.fn().mockRejectedValue(new Error('db down'));
      Object.assign(
        (service as unknown as { sendRepo: unknown }).sendRepo as object,
        { markPending },
      );

      await expect(service.dispatchOne('rem-1')).resolves.toMatchObject({
        result: 'sent',
      });
    });

    it('one failing reminder does not stop the others due in the same tick', async () => {
      const claim = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(REMINDER);
      const { service, findDueIds } = build({ claim });
      findDueIds.mockResolvedValue(['rem-bad', 'rem-1']);

      const outcomes = await service.dispatchDue();

      expect(outcomes).toEqual([
        { reminderId: 'rem-1', result: 'sent', recipientCount: 2 },
      ]);
    });
  });
});
