// src/server/emailTemplates.ts
// The app's emails, in the recipient's language. Email clients support little CSS, so these use a table
// layout, inline styles and hex colors from the forest palette (the theme's
// oklch tokens don't work in most clients). Each has a plain-text version.

import { createTranslator } from "next-intl";
import type { Locale } from "@/i18n/config";
import type { Email } from "@/server/email";
import { messagesFor } from "@/server/i18n";

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

function render(t: EmailT, { heading, paragraphs, button, footer }: Layout) {
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
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.muted}">${escapeHtml(t("linkFallback"))}</p>
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

// Translates in the email's language, from the messages' "emails" section
type EmailT = Awaited<ReturnType<typeof emailTranslator>>;

async function emailTranslator(locale: Locale) {
  return createTranslator({ locale, messages: await messagesFor(locale), namespace: "emails" });
}

const firstName = (name: string, t: EmailT) => name.trim().split(/\s+/)[0] || t("there");

export async function verifyEmail(to: string, name: string, url: string, locale: Locale): Promise<Email> {
  const t = await emailTranslator(locale);
  return {
    to,
    subject: t("verify.subject"),
    ...render(t, {
      heading: t("verify.heading"),
      paragraphs: [t("verify.body", { name: firstName(name, t) })],
      button: { label: t("verify.button"), url },
      footer: t("verify.footer"),
    }),
  };
}

export async function resetPasswordEmail(to: string, name: string, url: string, locale: Locale): Promise<Email> {
  const t = await emailTranslator(locale);
  return {
    to,
    subject: t("reset.subject"),
    ...render(t, {
      heading: t("reset.heading"),
      paragraphs: [t("reset.body1", { name: firstName(name, t) }), t("reset.body2")],
      button: { label: t("reset.button"), url },
      footer: t("reset.footer"),
    }),
  };
}

// Sent to the current address before an email change goes ahead
export async function confirmEmailChange(
  to: string,
  name: string,
  newEmail: string,
  url: string,
  locale: Locale
): Promise<Email> {
  const t = await emailTranslator(locale);
  return {
    to,
    subject: t("change.subject"),
    ...render(t, {
      heading: t("change.heading"),
      paragraphs: [t("change.body1", { name: firstName(name, t), email: newEmail }), t("change.body2")],
      button: { label: t("change.button"), url },
      footer: t("change.footer"),
    }),
  };
}
