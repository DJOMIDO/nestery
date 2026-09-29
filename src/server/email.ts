// src/server/email.ts
// Sends the app's emails (verification, password reset, email change) over
// SMTP: a Gmail account with an app password works without owning a domain,
// and any other SMTP service (e.g. Resend with a verified domain) only needs
// different env vars. Server-only.

import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
const from = process.env.EMAIL_FROM || (user ? `Nestery <${user}>` : undefined);

// Without SMTP settings emails are logged instead of sent, and email
// verification is not required (nobody could receive the link)
export const emailEnabled = Boolean(host && user && pass && from);

const transport = emailEnabled
  ? nodemailer.createTransport({
      host,
      port,
      // 465 is TLS from the start; 587 upgrades with STARTTLS
      secure: port === 465,
      auth: { user, pass },
    })
  : null;

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(email: Email) {
  if (!transport) {
    console.info(`[email not sent: SMTP is not configured] To: ${email.to} · ${email.subject}\n${email.text}`);
    return;
  }
  await transport.sendMail({ from, ...email });
}
