import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

describe('EmailService.sendLoaReadyEmail', () => {
  let service: EmailService;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return undefined;
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new EmailService(configService);
  });

  it('calls resolveEmailContent with type loa_ready and fallback loa-ready, then sendRawEmail', async () => {
    const sendRawEmail = jest
      .spyOn(service as any, 'sendRawEmail')
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, 'resolveEmailContent').mockResolvedValue({
      subject: 'Your Letter of Acceptance is Ready',
      html: '<p>Hi Jane</p>',
    });

    await service.sendLoaReadyEmail('jane@example.com', {
      participant_name: 'Jane Doe',
      program_name: 'YBB 2026',
      document_number: 'LOA-2026-000001',
      documents_page_url: 'https://ybb.io/dashboard/documents',
      brand_id: 'brand-1',
      program_id: 'prog-1',
    });

    expect(sendRawEmail).toHaveBeenCalledWith(
      'jane@example.com',
      'Your Letter of Acceptance is Ready',
      '<p>Hi Jane</p>',
    );
  });

  it('passes correct templateData to resolveEmailContent', async () => {
    jest
      .spyOn(service as any, 'sendRawEmail')
      .mockResolvedValue(undefined);
    const resolveEmailContent = jest
      .spyOn(service as any, 'resolveEmailContent')
      .mockResolvedValue({ subject: 'LoA Ready', html: '<p>test</p>' });

    await service.sendLoaReadyEmail('jane@example.com', {
      participant_name: 'Jane Doe',
      program_name: 'YBB 2026',
      document_number: 'LOA-2026-000001',
      documents_page_url: 'https://ybb.io/dashboard/documents',
      brand_id: 'brand-1',
      program_id: 'prog-1',
    });

    expect(resolveEmailContent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'loa_ready',
        fallbackTemplateName: 'loa-ready',
        data: expect.objectContaining({
          participant_name: 'Jane Doe',
          document_number: 'LOA-2026-000001',
          brandId: 'brand-1',
          programId: 'prog-1',
        }),
      }),
    );
  });
});
