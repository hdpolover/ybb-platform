import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import * as hbs from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private resend: Resend;
    private readonly logger = new Logger(EmailService.name);
    private readonly templateCache = new Map<string, hbs.TemplateDelegate>();

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

    private async compileTemplate(templateName: string, data: any): Promise<string> {
        // Check cache first
        const cached = this.templateCache.get(templateName);
        if (cached) {
            return this.renderWithLayout(cached, data);
        }

        const filePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
        
        try {
            // Read file asynchronously
            const template = await fs.promises.readFile(filePath, 'utf8');
            
            // Compile the template
            const compiled = hbs.compile(template);
            
            // Cache the compiled template
            this.templateCache.set(templateName, compiled);

            return this.renderWithLayout(compiled, data);
        } catch (error) {
            this.logger.error(`Failed to load template: ${templateName} from ${filePath}`, error);
            throw error;
        }
    }

    private renderWithLayout(compiledTemplate: hbs.TemplateDelegate, data: any): string {
        // If we have a layout, we might want to wrap it manually or use handlebars-layouts
        // For simplicity here, we'll assume the template extends the layout or is standalone
        // But to actually use the layout wrapper we defined earlier, we can do this:
        const layoutPath = path.join(__dirname, 'templates/layout.hbs');
        if (fs.existsSync(layoutPath)) {
            // Note: Layout caching could also be implemented for further optimization
            const layoutTemplate = fs.readFileSync(layoutPath, 'utf8');
            const layoutCompiled = hbs.compile(layoutTemplate);
            // Render the body first
            const body = compiledTemplate(data);
            // Then render the layout with the body
            return layoutCompiled({ ...data, body, year: new Date().getFullYear() });
        }

        return compiledTemplate(data);
    }

    async sendEmail(to: string, subject: string, html: string) {
        return this.sendRawEmail(to, subject, html);
    }

    async sendRawEmail(to: string, subject: string, html: string, attachments?: any[]) {
        this.logger.log(`[sendRawEmail] Attempting to send email to=${to}, subject="${subject}"`);
        
        // Option 1: Use Resend if available
        if (this.resend) {
            try {
                // If using Resend, we must use a verified sender or the onboarding one
                // For development, we might use onboarding@resend.dev
                // For production, we should use the configured sender
                const fromAddress = this.configService.get('RESEND_FROM') || 'onboarding@resend.dev';
                
                this.logger.log(`[sendRawEmail] Sending via Resend from=${fromAddress}`);
                
                const response = await this.resend.emails.send({
                    from: fromAddress,
                    to: to,
                    subject: subject,
                    html: html,
                    attachments: attachments,
                });

                if (response.error) {
                    this.logger.error(`Resend API Error: ${JSON.stringify(response.error)}`);
                    throw new Error(response.error.message);
                }

                this.logger.log(`Email sent via Resend. ID: ${response.data?.id} | Full Response: ${JSON.stringify(response)}`);
                return response;
            } catch (error) {
                this.logger.error(`Failed to send email via Resend to ${to}: ${error.message}`, error.stack);
                throw error;
            }
        }

        // Option 2: Use Nodemailer (Fallback/Dev)
        if (!this.transporter) {
            await this.createTransporter();
        }

        if (!this.transporter) {
            this.logger.warn(`Email not sent (no transporter): ${subject} to ${to}`);
            return;
        }

        try {
            const info = await this.transporter.sendMail({
                from: this.configService.get('SMTP_FROM') || '"YBB Notification" <no-reply@ybb.com>',
                to,
                subject,
                html,
                attachments,
            });

            this.logger.log(`Email sent via SMTP: ${info.messageId}`);
            if (this.configService.get('NODE_ENV') !== 'production' && nodemailer.getTestMessageUrl(info)) {
                this.logger.log(`Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            }
            return info;
        } catch (error) {
            this.logger.error(`Failed to send email via SMTP to ${to}`, error);
            throw error;
        }
    }

    async sendWelcomeEmail(to: string, name: string, brand?: any) {
        let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
        if (brand?.websiteUrl) {
            baseUrl = brand.websiteUrl.replace(/\/$/, '');
        }

        const html = await this.compileTemplate('welcome', {
            name,
            loginUrl: `${baseUrl}/login`,
            brand,
        });
        const subject = brand ? `Welcome to ${brand.name}` : 'Welcome to YBB Platform';
        return this.sendRawEmail(to, subject, html);
    }

    async sendEmailVerifiedEmail(to: string, name: string, brand?: any) {
        let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
        if (brand?.websiteUrl) {
            baseUrl = brand.websiteUrl.replace(/\/$/, '');
        }
        
        const html = await this.compileTemplate('email-verified', {
            name,
            loginUrl: `${baseUrl}/login`,
            brand,
        });
        const subject = brand ? `Email Verified - ${brand.name}` : 'Email Verified';
        return this.sendRawEmail(to, subject, html);
    }

    async sendPaymentSuccessEmail(to: string, paymentData: any, receiptBuffer?: Buffer) {
        const html = await this.compileTemplate('payment-success', {
            name: paymentData.name,
            amount: paymentData.amount,
            currency: paymentData.currency || 'IDR',
            orderId: paymentData.orderId,
            date: new Date().toLocaleDateString(),
            description: paymentData.description,
            invoiceUrl: paymentData.invoiceUrl || '#',
        });
        
        const attachments = receiptBuffer ? [{
            filename: `receipt-${paymentData.orderId}.pdf`,
            content: receiptBuffer,
        }] : [];

        return this.sendRawEmail(to, 'Payment Confirmation', html, attachments);
    }

    async sendForgotPasswordEmail(to: string, name: string, token: string, brand?: any) {
        let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
        if (brand?.websiteUrl) {
            baseUrl = brand.websiteUrl.replace(/\/$/, '');
        }

        const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

        const html = await this.compileTemplate('forgot-password', {
            name,
            resetUrl,
            brand
        });
        
        const subject = brand ? `Reset Your Password - ${brand.name}` : 'Reset Your Password';
        return this.sendRawEmail(to, subject, html);
    }

    async sendVerificationEmail(to: string, name: string, token: string, brand?: any) {
        this.logger.log(`[sendVerificationEmail] Preparing verification email for ${to} (name: ${name})`);
        // Determine base URL: modify logic to prioritize brand.websiteUrl
        let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
        
        if (brand?.websiteUrl) {
            // Remove trailing slash if present
            baseUrl = brand.websiteUrl.replace(/\/$/, '');
        }

        this.logger.log(`[sendVerificationEmail] Using base URL for link: ${baseUrl}`);

        const html = await this.compileTemplate('verify-email', {
            name,
            verificationUrl: `${baseUrl}/auth/verify-email?token=${token}`,
            brand,
        });
        const subject = brand ? `Verify Your Email for ${brand.name}` : 'Verify Your Email Address';
        return this.sendRawEmail(to, subject, html);
    }

    async sendManualPaymentReceivedEmail(to: string, paymentData: any) {
        const html = await this.compileTemplate('manual-payment-received', {
            name: paymentData.name,
            amount: paymentData.amount,
            currency: paymentData.currency || 'IDR',
            orderId: paymentData.orderId,
            date: new Date().toLocaleDateString(),
        });
        return this.sendRawEmail(to, 'Payment Proof Received', html);
    }

    async sendPaymentFailedEmail(to: string, paymentData: any) {
        const retryUrl = this.configService.get('FRONTEND_URL') 
            ? `${this.configService.get('FRONTEND_URL')}/dashboard/payments`
            : '#';

        const html = await this.compileTemplate('payment-failed', {
            name: paymentData.name,
            amount: paymentData.amount,
            currency: paymentData.currency || 'IDR',
            orderId: paymentData.orderId,
            date: new Date().toLocaleDateString(),
            reason: paymentData.reason,
            retryUrl: paymentData.retryUrl || retryUrl,
        });
        return this.sendRawEmail(to, 'Payment Failed', html);
    }

    async sendPaymentRefundedEmail(to: string, paymentData: any) {
        const html = await this.compileTemplate('payment-refunded', {
            name: paymentData.name,
            amount: paymentData.amount,
            currency: paymentData.currency || 'IDR',
            orderId: paymentData.orderId,
            date: new Date().toLocaleDateString(),
            description: paymentData.description,
        });
        return this.sendRawEmail(to, 'Payment Refunded', html);
    }
}
