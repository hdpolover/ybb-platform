import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// Real templates, stubbed transport + managed-template lookup: asserts the
// fallback subjects and that the new submitted template renders.
describe('EmailService fallback subjects', () => {
  let service: EmailService;
  let sendRawEmail: jest.SpyInstance;

  beforeEach(() => {
    const config = {
      get: (key: string) => (key === 'SMTP_HOST' ? 'localhost' : undefined),
    } as unknown as ConfigService;
    service = new EmailService(config);
    jest
      .spyOn(service as any, 'fetchManagedTemplate')
      .mockResolvedValue(null);
    sendRawEmail = jest
      .spyOn(service, 'sendRawEmail')
      .mockResolvedValue(undefined as never);
  });

  describe('sendApplicationSubmittedEmail', () => {
    const base = {
      name: 'Jane',
      applicationId: 'app-1',
      submittedAt: '2026-11-12T23:30:00.000Z',
      portalUrl: 'https://www.example.com/dashboard/submission',
    };

    it('puts the program name in the subject', async () => {
      await service.sendApplicationSubmittedEmail('j@example.com', {
        ...base,
        program: 'Korea Youth Summit',
        brand: { name: 'YBB' },
      });

      expect(sendRawEmail.mock.calls[0][1]).toBe(
        'Application Submitted - Korea Youth Summit',
      );
    });

    it('falls back to the brand name, then the bare subject', async () => {
      await service.sendApplicationSubmittedEmail('j@example.com', {
        ...base,
        program: '',
        brand: { name: 'YBB' },
      });
      await service.sendApplicationSubmittedEmail('j@example.com', {
        ...base,
        program: undefined,
      });

      expect(sendRawEmail.mock.calls[0][1]).toBe('Application Submitted - YBB');
      expect(sendRawEmail.mock.calls[1][1]).toBe('Application Submitted');
    });

    it('renders program, date, portal link and no acceptance promise', async () => {
      await service.sendApplicationSubmittedEmail('j@example.com', {
        ...base,
        program: 'Korea Youth Summit',
      });

      const html = sendRawEmail.mock.calls[0][2] as string;
      expect(html).toContain('Korea Youth Summit');
      expect(html).toContain('November 12, 2026');
      expect(html).toContain('https://www.example.com/dashboard/submission');
      expect(html).not.toMatch(/undefined/);
      expect(html).not.toMatch(/accepted|congratulations/i);
    });

    it('omits the date line when submittedAt is missing or invalid', async () => {
      await service.sendApplicationSubmittedEmail('j@example.com', {
        ...base,
        submittedAt: 'not-a-date',
      });

      expect(sendRawEmail.mock.calls[0][2]).not.toContain('Submitted on');
    });
  });

  describe('payment subjects', () => {
    it.each([
      [
        'sendPaymentSuccessEmail',
        { program: 'KYS' },
        'Payment Confirmed - KYS',
        'Payment Confirmation',
      ],
      [
        'sendPaymentRejectedEmail',
        { program: 'KYS' },
        'Payment Not Verified - KYS',
        'Payment Not Verified',
      ],
      [
        'sendPaymentIssueAlternativeEmail',
        { programName: 'KYS' },
        'Alternative Payment Options - KYS',
        'Alternative Payment Options for Your YBB Program',
      ],
    ])(
      '%s: names the program, falls back to the generic subject',
      async (method, withProgram, named, generic) => {
        const send = (service as any)[method].bind(service);
        const common = {
          name: 'Jane',
          amount: 1,
          currency: 'IDR',
          orderId: 'o-1',
        };

        await send('j@example.com', { ...common, ...withProgram });
        await send('j@example.com', {
          ...common,
          program: '   ',
          programName: null,
        });
        await send('j@example.com', common);

        expect(sendRawEmail.mock.calls[0][1]).toBe(named);
        expect(sendRawEmail.mock.calls[1][1]).toBe(generic);
        expect(sendRawEmail.mock.calls[2][1]).toBe(generic);
      },
    );
  });
});
