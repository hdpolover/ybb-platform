import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { RabbitMQProducerService } from './rabbitmq-producer.service';

describe('RabbitMQProducerService', () => {
  let service: RabbitMQProducerService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMQProducerService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RabbitMQProducerService>(RabbitMQProducerService);
  });

  describe('emitSafe', () => {
    // Regression for M86/M131: a broker hiccup on a fire-and-forget emit()
    // used to become an unhandled promise rejection that could crash the
    // whole process (HTTP app + every RMQ consumer share one process). This
    // pins that emitSafe() absorbs the failure instead of propagating it.
    it('does not reject or throw when the underlying emit() rejects', async () => {
      const publishError = new Error('Channel closed: broker unreachable');
      jest.spyOn(service, 'emit').mockRejectedValueOnce(publishError);

      await expect(
        service.emitSafe('user.verify-email', { email: 'a@b.com' }),
      ).resolves.toBe(false);
    });

    it('logs the failure at error level with the pattern and messageId when emit() rejects', async () => {
      const publishError = new Error('Channel closed: broker unreachable');
      jest.spyOn(service, 'emit').mockRejectedValueOnce(publishError);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await service.emitSafe('user.verify-email', { email: 'a@b.com' }, { messageId: 'msg-123' });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("pattern 'user.verify-email'"),
        publishError,
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('messageId: msg-123'),
        publishError,
      );

      errorSpy.mockRestore();
    });

    it('resolves true and does not log an error when the underlying emit() succeeds', async () => {
      jest.spyOn(service, 'emit').mockResolvedValueOnce(true);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.emitSafe('user.registered', { email: 'a@b.com' }),
      ).resolves.toBe(true);
      expect(errorSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });
});
