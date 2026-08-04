import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type TransporterLike = {
  sendMail: (options: {
    from?: string;
    to: string;
    subject: string;
    html: string;
  }) => Promise<unknown>;
};

type NodemailerModule = {
  createTransport: (options: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user?: string; pass?: string };
  }) => TransporterLike;
};

@Injectable()
export class MailService {
  private readonly transporter: TransporterLike = (
    nodemailer as unknown as NodemailerModule
  ).createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  async sendActivationEmail(email: string, token: string): Promise<void> {
    const activationUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/activate?token=${token}`;

    await this.transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Activate your account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <h2 style="margin: 0 0 12px; color: #111827;">Welcome aboard</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #374151; margin: 0 0 16px;">
            Thanks for signing up. To get started, please confirm your email address by activating your account.
          </p>
          <div style="margin: 24px 0;">
            <a href="${activationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
              Activate your account
            </a>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin: 0;">
            If you did not create this account, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  }
}
