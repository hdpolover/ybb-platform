import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);

    constructor(private configService: ConfigService) {
        this.createTransporter();
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

    async sendEmail(to: string, subject: string, html: string) {
        if (!this.transporter) {
            await this.createTransporter();
        }

        // Fallback if still no transporter (e.g. ethereal failed)
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
            });

            this.logger.log(`Email sent: ${info.messageId}`);
            if (this.configService.get('NODE_ENV') !== 'production' && nodemailer.getTestMessageUrl(info)) {
                this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            }
            return info;
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}`, error);
            throw error;
        }
    }
}
