import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import * as hbs from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { maskEmail } from '../../common/logging/safe-log';

interface ManagedEmailTemplate {
  id: string;
  type: string;
  subject: string;
  body: string;
  brandId?: string | null;
  programId?: string | null;
  updatedAt?: string;
}

export interface LoaReadyPayload {
  participant_name: string;
  program_name: string;
  document_number: string;
  documents_page_url: string;
  brand_id?: string;
  program_id?: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly templateCache = new Map<string, hbs.TemplateDelegate>();

  private readonly defaultThemePrimary = '#1D4ED8';

  constructor(private configService: ConfigService) {
    const resendKey = this.configService.get('RESEND_API_KEY');
    if (resendKey) {
      this.resend = new Resend(resendKey);
      this.logger.log('Resend client initialized');
    } else {
      this.createTransporter();
    }
    this.registerPartials();
  }

  private registerPartials() {
    try {
      const layoutPath = path.join(__dirname, 'templates/layout.hbs');
      const layout = fs.readFileSync(layoutPath, 'utf8');
      hbs.registerPartial('layout', layout);
    } catch (error) {
      this.logger.warn('Failed to load layout template', error);
    }
  }

  private async createTransporter() {
    // Check if we have explicit SMTP config, otherwise use Ethereal for dev
    const smtpHost = this.configService.get('SMTP_HOST');

    if (!smtpHost && this.configService.get('NODE_ENV') !== 'production') {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log(`Ethereal Email initialized: ${testAccount.user}`);
      } catch (e) {
        this.logger.error('Failed to create Ethereal account', e);
      }
    } else {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(this.configService.get('SMTP_PORT')) || 587,
        secure: this.configService.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
    }
  }

  private normalizeHexColor(color: unknown): string | null {
    if (typeof color !== 'string') {
      return null;
    }

    const trimmed = color.trim();
    const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

    if (!match) {
      return null;
    }

    let hex = match[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => `${char}${char}`)
        .join('');
    }

    return `#${hex.toUpperCase()}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    return { r, g, b };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const channelToHex = (channel: number) => {
      const clamped = Math.max(0, Math.min(255, Math.round(channel)));
      return clamped.toString(16).padStart(2, '0').toUpperCase();
    };

    return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
  }

  private mixHex(baseHex: string, targetHex: string, ratio: number): string {
    const base = this.hexToRgb(baseHex);
    const target = this.hexToRgb(targetHex);
    const safeRatio = Math.max(0, Math.min(1, ratio));

    return this.rgbToHex(
      base.r + (target.r - base.r) * safeRatio,
      base.g + (target.g - base.g) * safeRatio,
      base.b + (target.b - base.b) * safeRatio,
    );
  }

  private getReadableTextColor(backgroundHex: string): string {
    const { r, g, b } = this.hexToRgb(backgroundHex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? '#111827' : '#FFFFFF';
  }

  private buildTheme(brand?: any) {
    const colorCandidates = [
      brand?.primaryColor,
      brand?.theme?.primaryColor,
      brand?.settings?.primaryColor,
      brand?.metadata?.primaryColor,
      brand?.metadata?.theme?.primaryColor,
    ];

    let resolvedPrimary: string | null = null;
    for (const candidate of colorCandidates) {
      const normalized = this.normalizeHexColor(candidate);
      if (normalized) {
        resolvedPrimary = normalized;
        break;
      }
    }

    const primary = resolvedPrimary ?? this.defaultThemePrimary;

    return {
      primary,
      primaryDark: this.mixHex(primary, '#000000', 0.25),
      primarySoft: this.mixHex(primary, '#FFFFFF', 0.86),
      primaryMuted: this.mixHex(primary, '#FFFFFF', 0.93),
      border: this.mixHex(primary, '#FFFFFF', 0.76),
      onPrimary: this.getReadableTextColor(primary),
    };
  }

  private enrichTemplateData(data: any) {
    const safeData = data && typeof data === 'object' ? data : {};
    const theme = this.buildTheme(safeData.brand);

    const brand =
      safeData.brand && typeof safeData.brand === 'object'
        ? {
            ...safeData.brand,
            primaryColor:
              this.normalizeHexColor(safeData.brand.primaryColor) ??
              theme.primary,
          }
        : safeData.brand;

    return {
      ...safeData,
      brand,
      theme,
    };
  }

  private getTemplateApiBaseUrl(): string | null {
    const candidates = [
      this.configService.get<string>('API_INTERNAL_URL'),
      this.configService.get<string>('API_URL'),
    ];

    for (const candidate of candidates) {
      if (candidate?.trim()) {
        return candidate.replace(/\/$/, '');
      }
    }

    return null;
  }

  private buildTemplateResolveHeaders(): Record<string, string> {
    const internalKey = this.configService
      .get<string>('NOTIFICATION_SERVICE_INTERNAL_KEY', '')
      .trim();

    return internalKey ? { Authorization: `Bearer ${internalKey}` } : {};
  }

  private extractBrandId(data: any): string | undefined {
    const candidates = [data?.brandId, data?.brand?.id];
    return candidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );
  }

  private extractProgramId(data: any): string | undefined {
    const candidates = [data?.programId, data?.program?.id];
    return candidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );
  }

  private compileStringTemplate(source: string, data: any): string {
    const templateData = this.enrichTemplateData(data);
    return hbs.compile(source)(templateData);
  }

  private renderBodyWithLayout(body: string, data: any): string {
    const layoutPath = path.join(__dirname, 'templates/layout.hbs');
    if (fs.existsSync(layoutPath)) {
      const layoutTemplate = fs.readFileSync(layoutPath, 'utf8');
      const layoutCompiled = hbs.compile(layoutTemplate);
      return layoutCompiled({ ...data, body, year: new Date().getFullYear() });
    }

    return body;
  }

  private renderManagedTemplateBody(source: string, data: any): string {
    const templateData = this.enrichTemplateData(data);
    const body = hbs.compile(source)(templateData);
    return this.renderBodyWithLayout(body, templateData);
  }

  private async fetchManagedTemplate(
    type: string,
    data: any,
  ): Promise<ManagedEmailTemplate | null> {
    const baseUrl = this.getTemplateApiBaseUrl();
    if (!baseUrl) {
      return null;
    }

    const params = new URLSearchParams({ type });
    const brandId = this.extractBrandId(data);
    const programId = this.extractProgramId(data);

    if (brandId) {
      params.set('brandId', brandId);
    }
    if (programId) {
      params.set('programId', programId);
    }

    try {
      const response = await fetch(
        `${baseUrl}/internal/email-templates/resolve?${params.toString()}`,
        {
          method: 'GET',
          headers: this.buildTemplateResolveHeaders(),
        },
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn(
          `Template lookup failed for ${type}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const payload = (await response.json()) as ManagedEmailTemplate | null;
      if (!payload || typeof payload !== 'object') {
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.warn(
        `Managed template lookup failed for ${type}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async resolveEmailContent(options: {
    type: string;
    fallbackTemplateName: string;
    fallbackSubject: string;
    data: any;
  }): Promise<{ subject: string; html: string }> {
    const managedTemplate = await this.fetchManagedTemplate(
      options.type,
      options.data,
    );

    if (managedTemplate?.body?.trim() && managedTemplate.subject?.trim()) {
      return {
        subject: this.compileStringTemplate(
          managedTemplate.subject,
          options.data,
        ),
        html: this.renderManagedTemplateBody(
          managedTemplate.body,
          options.data,
        ),
      };
    }

    return {
      subject: options.fallbackSubject,
      html: await this.compileTemplate(
        options.fallbackTemplateName,
        options.data,
      ),
    };
  }

  private async compileTemplate(
    templateName: string,
    data: any,
  ): Promise<string> {
    const templateData = this.enrichTemplateData(data);

    // Check cache first
    const cached = this.templateCache.get(templateName);
    if (cached) {
      return this.renderWithLayout(cached, templateData);
    }

    const filePath = path.join(__dirname, 'templates', `${templateName}.hbs`);

    try {
      // Read file asynchronously
      const template = await fs.promises.readFile(filePath, 'utf8');

      // Compile the template
      const compiled = hbs.compile(template);

      // Cache the compiled template
      this.templateCache.set(templateName, compiled);

      return this.renderWithLayout(compiled, templateData);
    } catch (error) {
      this.logger.error(
        `Failed to load template: ${templateName} from ${filePath}`,
        error,
      );
      throw error;
    }
  }

  private renderWithLayout(
    compiledTemplate: hbs.TemplateDelegate,
    data: any,
  ): string {
    return this.renderBodyWithLayout(compiledTemplate(data), data);
  }

  async sendEmail(to: string, subject: string, html: string) {
    return this.sendRawEmail(to, subject, html);
  }

  async sendRawEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: any[],
  ) {
    this.logger.log(
      `[sendRawEmail] Attempting email delivery to=${maskEmail(to)}, subject="${subject}"`,
    );

    // Option 1: Use Resend if available
    if (this.resend) {
      try {
        // If using Resend, we must use a verified sender or the onboarding one
        // For development, we might use onboarding@resend.dev
        // For production, we should use the configured sender
        const fromAddress =
          this.configService.get('RESEND_FROM') || 'onboarding@resend.dev';

        this.logger.log(
          `[sendRawEmail] Sending via Resend from=${fromAddress}`,
        );

        const response = await this.resend.emails.send({
          from: fromAddress,
          to: to,
          subject: subject,
          html: html,
          attachments: attachments,
        });

        if (response.error) {
          this.logger.error(
            `Resend API Error: ${JSON.stringify(response.error)}`,
          );
          throw new Error(response.error.message);
        }

        this.logger.log(
          `Email sent via Resend. id=${response.data?.id ?? 'unknown'}`,
        );
        return response;
      } catch (error) {
        this.logger.error(
          `Failed to send email via Resend to ${maskEmail(to)}: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }

    // Option 2: Use Nodemailer (Fallback/Dev)
    if (!this.transporter) {
      await this.createTransporter();
    }

    if (!this.transporter) {
      this.logger.warn(
        `Email not sent (no transporter): ${subject} to ${maskEmail(to)}`,
      );
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from:
          this.configService.get('SMTP_FROM') ||
          '"YBB Notification" <no-reply@ybb.com>',
        to,
        subject,
        html,
        attachments,
      });

      this.logger.log(`Email sent via SMTP: ${info.messageId}`);
      if (
        this.configService.get('NODE_ENV') !== 'production' &&
        nodemailer.getTestMessageUrl(info)
      ) {
        this.logger.log(
          `Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`,
        );
      }
      return info;
    } catch (error) {
      this.logger.error(
        `Failed to send email via SMTP to ${maskEmail(to)}`,
        error,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, name: string, brand?: any) {
    let baseUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    if (brand?.websiteUrl) {
      baseUrl = brand.websiteUrl.replace(/\/$/, '');
    }

    const templateData = {
      name,
      loginUrl: `${baseUrl}/login`,
      brand,
    };
    const fallbackSubject = brand
      ? `Welcome to ${brand.name}`
      : 'Welcome to YBB Platform';
    const { subject, html } = await this.resolveEmailContent({
      type: 'welcome',
      fallbackTemplateName: 'welcome',
      fallbackSubject,
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendEmailVerifiedEmail(to: string, name: string, brand?: any) {
    let baseUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    if (brand?.websiteUrl) {
      baseUrl = brand.websiteUrl.replace(/\/$/, '');
    }

    const templateData = {
      name,
      loginUrl: `${baseUrl}/login`,
      brand,
    };
    const fallbackSubject = brand
      ? `Email Verified - ${brand.name}`
      : 'Email Verified';
    const { subject, html } = await this.resolveEmailContent({
      type: 'email_verified',
      fallbackTemplateName: 'email-verified',
      fallbackSubject,
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendPaymentSuccessEmail(
    to: string,
    paymentData: any,
    receiptBuffer?: Buffer,
  ) {
    const templateData = {
      name: paymentData.name,
      amount: paymentData.amount,
      currency: paymentData.currency || 'IDR',
      orderId: paymentData.orderId,
      date: new Date().toLocaleDateString(),
      description: paymentData.description,
      invoiceUrl: paymentData.invoiceUrl || '#',
      paymentsPageUrl:
        paymentData.paymentsPageUrl || paymentData.invoiceUrl || '#',
      submissionPageUrl: paymentData.submissionPageUrl || '',
      brand: paymentData.brand,
      program: paymentData.program,
      brandId: paymentData.brandId,
      programId: paymentData.programId,
    };

    const attachments = receiptBuffer
      ? [
          {
            filename: `receipt-${paymentData.orderId}.pdf`,
            content: receiptBuffer,
          },
        ]
      : [];

    const { subject, html } = await this.resolveEmailContent({
      type: 'payment_received',
      fallbackTemplateName: 'payment-success',
      fallbackSubject: 'Payment Confirmation',
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html, attachments);
  }

  async sendForgotPasswordEmail(
    to: string,
    name: string,
    token: string,
    brand?: any,
  ) {
    let baseUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    if (brand?.websiteUrl) {
      baseUrl = brand.websiteUrl.replace(/\/$/, '');
    }

    const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl)
      ? baseUrl
      : `https://${baseUrl}`;
    const resetUrl = `${normalizedBaseUrl.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(token)}`;

    const templateData = {
      name,
      resetUrl,
      brand,
    };

    const fallbackSubject = brand
      ? `Reset Your Password - ${brand.name}`
      : 'Reset Your Password';
    const { subject, html } = await this.resolveEmailContent({
      type: 'password_reset',
      fallbackTemplateName: 'forgot-password',
      fallbackSubject,
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
    brand?: any,
  ) {
    this.logger.log(
      `[sendVerificationEmail] Preparing verification email for ${maskEmail(to)} (name: ${name})`,
    );
    // Determine base URL: modify logic to prioritize brand.websiteUrl
    let baseUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    if (brand?.websiteUrl) {
      // Remove trailing slash if present
      baseUrl = brand.websiteUrl.replace(/\/$/, '');
    }

    this.logger.log(
      `[sendVerificationEmail] Using base URL for link: ${baseUrl}`,
    );

    const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl)
      ? baseUrl
      : `https://${baseUrl}`;
    const verificationUrl = `${normalizedBaseUrl.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(token)}`;

    const templateData = {
      name,
      verificationUrl,
      brand,
    };
    const fallbackSubject = brand
      ? `Verify Your Email for ${brand.name}`
      : 'Verify Your Email Address';
    const { subject, html } = await this.resolveEmailContent({
      type: 'email_verification',
      fallbackTemplateName: 'verify-email',
      fallbackSubject,
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendManualPaymentReceivedEmail(to: string, paymentData: any) {
    const templateData = {
      name: paymentData.name,
      amount: paymentData.amount,
      currency: paymentData.currency || 'IDR',
      orderId: paymentData.orderId,
      date: new Date().toLocaleDateString(),
      brand: paymentData.brand,
      program: paymentData.program,
      brandId: paymentData.brandId,
      programId: paymentData.programId,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'manual_payment_received',
      fallbackTemplateName: 'manual-payment-received',
      fallbackSubject: 'Payment Proof Received',
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendPaymentFailedEmail(to: string, paymentData: any) {
    const retryUrl = this.configService.get('FRONTEND_URL')
      ? `${this.configService.get('FRONTEND_URL')}/dashboard/payments`
      : '#';

    const templateData = {
      name: paymentData.name,
      amount: paymentData.amount,
      currency: paymentData.currency || 'IDR',
      orderId: paymentData.orderId,
      date: new Date().toLocaleDateString(),
      reason: paymentData.reason,
      retryUrl: paymentData.retryUrl || retryUrl,
      brand: paymentData.brand,
      program: paymentData.program,
      brandId: paymentData.brandId,
      programId: paymentData.programId,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'payment_failed',
      fallbackTemplateName: 'payment-failed',
      fallbackSubject: 'Payment Failed',
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendPaymentRejectedEmail(to: string, paymentData: any) {
    const fallbackPaymentsUrl = this.configService.get('FRONTEND_URL')
      ? `${this.configService.get('FRONTEND_URL')}/dashboard/payments`
      : '#';

    const templateData = {
      name: paymentData.name,
      amount: paymentData.amount,
      currency: paymentData.currency || 'IDR',
      orderId: paymentData.orderId,
      date: new Date().toLocaleDateString(),
      reason: paymentData.reason || 'No reason provided',
      paymentsPageUrl: paymentData.paymentsPageUrl || fallbackPaymentsUrl,
      brand: paymentData.brand,
      program: paymentData.program,
      brandId: paymentData.brandId,
      programId: paymentData.programId,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'payment_rejected',
      fallbackTemplateName: 'payment-rejected',
      fallbackSubject: 'Payment Not Verified',
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendPaymentRefundedEmail(to: string, paymentData: any) {
    const templateData = {
      name: paymentData.name,
      amount: paymentData.amount,
      currency: paymentData.currency || 'IDR',
      orderId: paymentData.orderId,
      date: new Date().toLocaleDateString(),
      description: paymentData.description,
      brand: paymentData.brand,
      program: paymentData.program,
      brandId: paymentData.brandId,
      programId: paymentData.programId,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'payment_refunded',
      fallbackTemplateName: 'payment-refunded',
      fallbackSubject: 'Payment Refunded',
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendSupportTicketCreatedEmail(to: string, payload: any) {
    const templateData = {
      name: payload.name || 'Participant',
      ticketNumber: payload.ticketNumber,
      subject: payload.subject,
      category: payload.category,
      subCategory: payload.subCategory,
      priority: payload.priority,
      status: payload.status || 'open',
      supportUrl: this.resolveSupportUrl(payload.brand),
      brand: payload.brand,
      program: payload.program,
      brandId: payload.brandId ?? payload.brand?.id,
      programId: payload.programId ?? payload.program?.id,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'support_ticket_created',
      fallbackTemplateName: 'support-ticket-created',
      fallbackSubject: `Support Ticket Received (${payload.ticketNumber})`,
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendSupportTicketReplyEmail(to: string, payload: any) {
    const templateData = {
      name: payload.name || 'Participant',
      ticketNumber: payload.ticketNumber,
      subject: payload.subject,
      status: payload.status,
      responderName: payload.responderName || 'Support Team',
      messagePreview:
        payload.messagePreview || 'You have a new update from support.',
      supportUrl: this.resolveSupportUrl(payload.brand),
      brand: payload.brand,
      program: payload.program,
      brandId: payload.brandId ?? payload.brand?.id,
      programId: payload.programId ?? payload.program?.id,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'support_ticket_replied',
      fallbackTemplateName: 'support-ticket-replied',
      fallbackSubject: `New Support Reply (${payload.ticketNumber})`,
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendSupportTicketStatusUpdatedEmail(to: string, payload: any) {
    const templateData = {
      name: payload.name || 'Participant',
      ticketNumber: payload.ticketNumber,
      subject: payload.subject,
      previousStatus: payload.previousStatus,
      status: payload.status,
      supportUrl: this.resolveSupportUrl(payload.brand),
      brand: payload.brand,
      program: payload.program,
      brandId: payload.brandId ?? payload.brand?.id,
      programId: payload.programId ?? payload.program?.id,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'support_ticket_status_updated',
      fallbackTemplateName: 'support-ticket-status-updated',
      fallbackSubject: `Support Ticket Status Updated (${payload.ticketNumber})`,
      data: templateData,
    });
    return this.sendRawEmail(to, subject, html);
  }

  async sendLoaReadyEmail(to: string, payload: LoaReadyPayload): Promise<void> {
    const templateData = {
      participant_name: payload.participant_name,
      program_name: payload.program_name,
      document_number: payload.document_number,
      documents_page_url: payload.documents_page_url,
      brandId: payload.brand_id,
      programId: payload.program_id,
    };
    const { subject, html } = await this.resolveEmailContent({
      type: 'loa_ready',
      fallbackTemplateName: 'loa-ready',
      fallbackSubject: 'Your Letter of Acceptance is Ready',
      data: templateData,
    });
    await this.sendRawEmail(to, subject, html);
  }

  private resolveSupportUrl(brand?: any): string {
    const baseUrl =
      brand?.websiteUrl?.replace(/\/$/, '') ||
      this.configService.get('FRONTEND_URL') ||
      'http://localhost:3001';
    return `${baseUrl}/dashboard/support-tickets`;
  }
}
