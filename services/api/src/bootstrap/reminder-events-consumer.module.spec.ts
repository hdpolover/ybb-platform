// src/bootstrap/reminder-events-consumer.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReminderEventsConsumerModule } from './reminder-events-consumer.module';
import { ReminderSendResultsController } from '@modules/reminders/presentation/reminder-send-results.controller';
import { ParticipantReminderDispatchService } from '@modules/reminders/application/services/participant-reminder-dispatch.service';
import { LoaSendResultsController } from '@modules/programs/presentation/loa-send-results.controller';

describe('ReminderEventsConsumerModule', () => {
  let moduleRef: TestingModule;

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves the result consumer without dragging in the @Cron dispatcher', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ReminderEventsConsumerModule],
    }).compile();

    expect(moduleRef.get(ReminderSendResultsController, { strict: false })).toBeDefined();
    // The scheduler must live in exactly one place — the HTTP app. Registering
    // it here would give it a second home and a second set of ticks.
    expect(() =>
      moduleRef.get(ParticipantReminderDispatchService, { strict: false }),
    ).toThrow();
    // And this queue must not pick up another module's @EventPattern handlers.
    expect(() => moduleRef.get(LoaSendResultsController, { strict: false })).toThrow();
  });
});
