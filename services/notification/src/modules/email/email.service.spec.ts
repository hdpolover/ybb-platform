import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EMAIL_SEND_CONCURRENCY,
  EmailService,
  SMTP_MAX_MESSAGES_PER_SECOND,
} from './email.service';

// Real nodemailer, wrapped so the transport options can be asserted.
jest.mock('nodemailer', () => {
  const actual = jest.requireActual<typeof import('nodemailer')>('nodemailer');
  return { ...actual, createTransport: jest.fn(actual.createTransport) };
});

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
      expect(html).toContain('November 13, 2026');
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
      [
        'sendManualPaymentReceivedEmail',
        { program: 'KYS' },
        'Payment Proof Received - KYS',
        'Payment Proof Received',
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

  describe('sendDraftNudgeEmail', () => {
    const base = {
      name: 'Jane',
      nudgeNumber: 1,
      submissionUrl: 'https://www.example.com/dashboard/submission',
    };

    it('uses the program in the subject, with a stronger subject for nudge 2', async () => {
      await service.sendDraftNudgeEmail('j@example.com', { ...base, program: 'Korea Youth Summit' });
      await service.sendDraftNudgeEmail('j@example.com', {
        ...base,
        nudgeNumber: 2,
        program: 'Korea Youth Summit',
      });

      expect(sendRawEmail.mock.calls[0][1]).toBe('Complete Your Registration - Korea Youth Summit');
      expect(sendRawEmail.mock.calls[1][1]).toBe(
        'Last Reminder: Complete Your Registration - Korea Youth Summit',
      );
    });

    it('falls back to a generic subject without a program', async () => {
      await service.sendDraftNudgeEmail('j@example.com', { ...base, program: '' });
      await service.sendDraftNudgeEmail('j@example.com', { ...base, nudgeNumber: 2 });

      expect(sendRawEmail.mock.calls[0][1]).toBe('Complete Your Registration');
      expect(sendRawEmail.mock.calls[1][1]).toBe('Last Reminder: Complete Your Registration');
    });

    it('renders without a deadline: no deadline line, no "undefined", no blank greeting', async () => {
      await service.sendDraftNudgeEmail('j@example.com', {
        ...base,
        name: '',
        program: 'Korea Youth Summit',
      });

      const html = sendRawEmail.mock.calls[0][2] as string;
      expect(html).toContain('Hi there,');
      expect(html).toContain('Korea Youth Summit');
      expect(html).toContain('registration fee is required');
      expect(html).toContain('https://www.example.com/dashboard/submission');
      expect(html).not.toContain('Submission deadline');
      expect(html).not.toMatch(/undefined|Hi ,/);
    });

    it('renders the deadline as a WIB calendar date when present', async () => {
      await service.sendDraftNudgeEmail('j@example.com', {
        ...base,
        deadline: '2026-12-20T17:30:00.000Z', // 21 Dec 00:30 WIB
      });

      const html = sendRawEmail.mock.calls[0][2] as string;
      expect(html).toContain('Submission deadline');
      expect(html).toContain('December 21, 2026');
    });
  });

  describe('sendFundingResultEmail', () => {
    const base = {
      name: 'Jane',
      portalUrl: 'https://www.example.com/dashboard',
    };

    it('puts the program in the subject, with a generic fallback', async () => {
      await service.sendFundingResultEmail('j@example.com', {
        ...base,
        decision: 'awarded',
        program: 'Korea Youth Summit',
      });
      await service.sendFundingResultEmail('j@example.com', {
        ...base,
        decision: 'not_awarded',
        program: '',
      });

      expect(sendRawEmail.mock.calls[0][1]).toBe('Your Fully Funded Result - Korea Youth Summit');
      expect(sendRawEmail.mock.calls[1][1]).toBe('Your Fully Funded Result');
    });

    it('awarded: congratulates, points to the portal next steps, links the portal', async () => {
      await service.sendFundingResultEmail('j@example.com', {
        ...base,
        decision: 'awarded',
        program: 'Korea Youth Summit',
      });

      const html = sendRawEmail.mock.calls[0][2] as string;
      expect(html).toContain('Congratulations, Jane!');
      expect(html).toContain('selected for the Fully Funded scheme');
      expect(html).toContain('Your next steps are in the participant portal');
      expect(html).toContain('href="https://www.example.com/dashboard"');
      expect(html).not.toContain('Self-Funded');
      expect(html).not.toMatch(/undefined|Hi ,/);
    });

    it('not awarded: factual, offers Self-Funded, no congratulations', async () => {
      await service.sendFundingResultEmail('j@example.com', {
        ...base,
        decision: 'not_awarded',
        program: 'Korea Youth Summit',
      });

      const html = sendRawEmail.mock.calls[0][2] as string;
      expect(html).toContain('not able to select you for the Fully Funded scheme this time');
      expect(html).toContain('still join the program as a Self-Funded participant');
      expect(html).toContain('details are in your participant portal');
      expect(html).toContain('href="https://www.example.com/dashboard"');
      expect(html).not.toContain('Congratulations');
      expect(html).not.toMatch(/undefined|Hi ,/);
    });

    it.each(['awarded', 'not_awarded'] as const)(
      '%s: falls back to "there" when full_name is blank',
      async (decision) => {
        await service.sendFundingResultEmail('j@example.com', { ...base, name: '', decision });

        const html = sendRawEmail.mock.calls[0][2] as string;
        expect(html).toContain('there');
        expect(html).not.toMatch(/undefined|Hi ,|Congratulations, !/);
      },
    );
  });
});

describe('EmailService transport routing (SES SMTP primary, Resend fallback)', () => {
  const build = (opts: { smtp: boolean; resend: boolean }) => {
    const service = new EmailService({
      get: (key: string) => (key === 'SMTP_HOST' ? 'localhost' : undefined),
    } as unknown as ConfigService);
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'ses-1' });
    const resendSend = jest
      .fn()
      .mockResolvedValue({ data: { id: 'rs-1' }, error: null });
    (service as any).transporter = opts.smtp ? { sendMail } : undefined;
    (service as any).resend = opts.resend
      ? { emails: { send: resendSend } }
      : undefined;
    return { service, sendMail, resendSend };
  };

  it('sends via SMTP and never touches Resend when SMTP succeeds', async () => {
    const { service, sendMail, resendSend } = build({ smtp: true, resend: true });

    await expect(service.sendRawEmail('a@x.com', 'S', '<p>h</p>')).resolves.toEqual({
      messageId: 'ses-1',
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('falls back to Resend when SMTP fails', async () => {
    const { service, sendMail, resendSend } = build({ smtp: true, resend: true });
    sendMail.mockRejectedValue(new Error('Throttling: Maximum sending rate exceeded'));

    await service.sendRawEmail('a@x.com', 'S', '<p>h</p>');
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  it('rethrows the SMTP error when there is no Resend fallback', async () => {
    const { service, sendMail } = build({ smtp: true, resend: false });
    sendMail.mockRejectedValue(new Error('boom'));

    await expect(service.sendRawEmail('a@x.com', 'S', '<p>h</p>')).rejects.toThrow('boom');
  });

  it('uses Resend alone when SMTP is not configured', async () => {
    const { service, resendSend } = build({ smtp: false, resend: true });

    await service.sendRawEmail('a@x.com', 'S', '<p>h</p>');
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  it('pools SMTP connections and caps the send rate under the SES limit', () => {
    const createTransport = nodemailer.createTransport as jest.Mock;
    createTransport.mockClear();

    build({ smtp: true, resend: false });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: true,
        maxConnections: EMAIL_SEND_CONCURRENCY,
        rateDelta: 1000,
        rateLimit: SMTP_MAX_MESSAGES_PER_SECOND,
        maxRequeues: 1,
      }),
    );
    expect(SMTP_MAX_MESSAGES_PER_SECOND).toBeLessThan(14);
  });

  it('keeps Resend sends one at a time when the consumer handles messages in parallel', async () => {
    const { service, resendSend } = build({ smtp: false, resend: true });
    let inFlight = 0;
    let maxInFlight = 0;
    resendSend.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { data: { id: 'rs-1' }, error: null };
    });

    await Promise.all(
      ['a@x.com', 'b@x.com', 'c@x.com'].map((to) =>
        service.sendRawEmail(to, 'S', '<p>h</p>'),
      ),
    );

    expect(resendSend).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
  });

  it('still sends the next Resend mail after one fails', async () => {
    const { service, resendSend } = build({ smtp: false, resend: true });
    resendSend
      .mockRejectedValueOnce(new Error('rate_limit_exceeded'))
      .mockResolvedValue({ data: { id: 'rs-2' }, error: null });

    const [first, second] = await Promise.allSettled([
      service.sendRawEmail('a@x.com', 'S', '<p>h</p>'),
      service.sendRawEmail('b@x.com', 'S', '<p>h</p>'),
    ]);

    expect(first.status).toBe('rejected');
    expect(second.status).toBe('fulfilled');
  });
});
