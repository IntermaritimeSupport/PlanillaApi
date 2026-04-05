import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  APP_NAME,
  APP_URL,
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(SMTP_PORT || '587'),
  secure: parseInt(SMTP_PORT || '587') === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  code: string
): Promise<void> {
  const appName = APP_NAME || 'Flow IT';
  const appUrl = APP_URL || 'http://localhost:5173';

  await transporter.sendMail({
    from: `"${appName}" <${SMTP_FROM || SMTP_USER}>`,
    to,
    subject: `${appName} — Password Reset Code`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
        <h2 style="color: #1e40af; margin-bottom: 8px;">${appName}</h2>
        <p style="color: #374151;">Hello <strong>${username}</strong>,</p>
        <p style="color: #374151;">We received a request to reset your password. Use the code below:</p>
        <div style="background: #1e40af; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 24px; border-radius: 8px; margin: 24px 0;">
          ${code}
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in <strong>15 minutes</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${appName} · ${appUrl}</p>
      </div>
    `,
  });
}
