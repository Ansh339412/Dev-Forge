import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Sends through the Resend HTTP API when RESEND_API_KEY is set (production),
 * otherwise through SMTP (MailHog locally).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: nodemailer.Transporter;
  private readonly resendKey?: string;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.resendKey = config.get<string>('RESEND_API_KEY') || undefined;
    if (!this.resendKey) {
      const user = config.get<string>('SMTP_USER');
      this.transporter = nodemailer.createTransport({
        host: config.getOrThrow<string>('SMTP_HOST'),
        port: Number(config.getOrThrow<string>('SMTP_PORT')),
        secure: false,
        auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
      });
    }
  }

  /** Never throws: a mail outage must not fail the request that triggered it. */
  async send(to: string, subject: string, text: string): Promise<void> {
    try {
      if (this.resendKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: this.from, to: [to], subject, text }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Resend responded with HTTP ${res.status}`);
        return;
      }
      await this.transporter!.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" email: ${(err as Error).message}`);
    }
  }
}
