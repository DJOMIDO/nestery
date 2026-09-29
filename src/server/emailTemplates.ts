// src/server/emailTemplates.ts
// The app's emails. Email clients support little CSS, so these use a table
// layout, inline styles and hex colors from the forest palette (the theme's
// oklch tokens don't work in most clients). Each has a plain-text version.

import type { Email } from "@/server/email";

// Hex equivalents of the theme's light-mode oklch tokens
const COLORS = {
  page: "#f5f6f0", // --background
  card: "#ffffff", // --card
  text: "#080a08", // --foreground
  muted: "#737268", // --muted-foreground
  forest: "#325642", // --forest (button)
  border: "#e1e2da", // --border
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Layout {
  // Plain text; escaped here
  heading: string;
  paragraphs: string[];
  button: { label: string; url: string };
  footer: string;
}

function render({ heading, paragraphs, button, footer }: Layout) {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text}">${escapeHtml(text)}</p>`;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLORS.page};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:10px">
          <tr><td style="padding:28px 28px 8px">
            <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:${COLORS.forest}">Nestery</p>
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${COLORS.text}">${escapeHtml(heading)}</h1>
            ${paragraphs.map(p).join("\n            ")}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:8px;background:${COLORS.forest}">
              <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(button.label)}</a>
            </td></tr></table>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.muted}">If the button doesn't work, copy this link into your browser:</p>
            <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all"><a href="${escapeHtml(button.url)}" style="color:${COLORS.forest}">${escapeHtml(button.url)}</a></p>
          </td></tr>
          <tr><td style="padding:16px 28px 24px;border-top:1px solid ${COLORS.border}">
            <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted}">${escapeHtml(footer)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = [`Nestery`, ``, heading, ``, ...paragraphs.flatMap((t) => [t, ``]), `${button.label}: ${button.url}`, ``, footer].join("\n");
  return { html, text };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

export function verifyEmail(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Confirm your email for Nestery",
    ...render({
      heading: "Confirm your email",
      paragraphs: [`Hi ${firstName(name)}, thanks for signing up. Confirm this is your email address to start using Nestery.`],
      button: { label: "Confirm email", url },
      footer: "The link works for 24 hours. If you didn't create a Nestery account, you can ignore this email.",
    }),
  };
}

export function resetPasswordEmail(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Reset your Nestery password",
    ...render({
      heading: "Reset your password",
      paragraphs: [
        `Hi ${firstName(name)}, someone (hopefully you) asked to reset the password of your Nestery account.`,
        "Choose a new password with the button below. Your other devices will be signed out.",
      ],
      button: { label: "Choose a new password", url },
      footer: "The link works for 1 hour. If you didn't ask for this, you can ignore this email; your password stays the same.",
    }),
  };
}

// Sent to the current address before an email change goes ahead
export function confirmEmailChange(to: string, name: string, newEmail: string, url: string): Email {
  return {
    to,
    subject: "Confirm your new email address for Nestery",
    ...render({
      heading: "Change your email?",
      paragraphs: [
        `Hi ${firstName(name)}, you asked to change the email of your Nestery account to ${newEmail}.`,
        "Approve the change below. We'll then send a link to the new address to confirm it.",
      ],
      button: { label: "Approve the change", url },
      footer: "If you didn't ask for this, ignore this email and your address stays the same. Consider changing your password.",
    }),
  };
}
