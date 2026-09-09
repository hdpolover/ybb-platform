// src/bootstrap/loa-events-consumer.module.spec.ts
//
// This module was the only consumer bootstrap without a compile test, which
// matters more than it sounds: a missing provider in a Nest module graph is
// not a type error and not a unit-test failure — it surfaces only when the
// container boots, i.e. as a production crash-loop. The other five consumers
// each have this guard; loa-events did not, and it is one of the containers
// the M219 module split changed.
import { Test, TestingModule } from '@nestjs/testing';
import { LoaEventsConsumerModule } from './loa-events-consumer.module';
import { LoaSendResultsController } from '@modules/programs/presentation/loa-send-results.controller';
import { LoaBatchRecipientSendRepository } from '@modules/programs/infrastructure/persistence/loa-batch-recipient-send.repository';
import { ReminderSendResultsController } from '@modules/reminders/presentation/reminder-send-results.controller';

describe('LoaEventsConsumerModule', () => {
  let moduleRef: TestingModule;

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves its whole dependency graph', async () => {
    // .compile() resolves every provider constructor, so a dependency the
    // M219 split stopped exporting fails HERE rather than at container boot.
    moduleRef = await Test.createTestingModule({
      imports: [LoaEventsConsumerModule],
    }).compile();

    expect(moduleRef.get(LoaSendResultsController, { strict: false })).toBeDefined();
    expect(moduleRef.get(LoaBatchRecipientSendRepository, { strict: false })).toBeDefined();
  });

  it('does not pick up another consumer queue @EventPattern handlers', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [LoaEventsConsumerModule],
    }).compile();

    // Registering another module's controller here would bind its handlers to
    // THIS container's queue and silently steal messages from it.
    expect(() => moduleRef.get(ReminderSendResultsController, { strict: false })).toThrow();
  });
});
