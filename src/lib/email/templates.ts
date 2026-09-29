import "server-only";
import type { SelectionInfo } from "@/config/selection";

/**
 * Plain HTML, deliberately.
 *
 * Email clients are a decade behind browsers — no flexbox, no grid, no external
 * CSS. Tables and inline styles are the only things that render the same in
 * Gmail, Outlook and every phone client. Every template also returns a text
 * version, which materially affects whether Gmail files it under Promotions.
 */

export type TemplateName =
  | "confirmation"
  | "waitlisted"
  | "approved"
  | "rejected"
  | "ticket"
  | "certificate";

export type TemplatePayload = {
  name: string;
  event_title: string;
  event_dates: string;
  venue: string | null;
  code: string;
  ticket_url: string;
  fee_label?: string;
  refund_terms?: string | null;
  reason?: string;
  /**
   * Set on the "confirmation" email when the registration is still PENDING —
   * an event with `auto_approve: false` reviews teams by hand, so nobody gets
   * told they're confirmed (or gets a QR) until an admin actually approves
   * them. Absent/false means the registration was auto-approved already.
   */
  pending?: boolean;
  /**
   * Mirrors `event-features.ticket`. False means this event issues no QR at
   * all — the "approved" email must not attach or reference one, even though
   * it normally does.
   */
  has_ticket?: boolean;
  /**
   * The group to invite someone to join, if this event has one (see
   * `@/config/community`). Rendered as a button on "confirmation" and
   * "approved" — for a no-ticket event (see `has_ticket`), this is the only
   * next step in either email, so it has to carry the weight the QR usually
   * does.
   */
  community?: { url: string; label: string; reason: string } | null;
  /**
   * Per-event "you've been selected" copy and links (form, rulebook, …) for
   * the "approved" email — see `@/config/selection`. Absent means the plain
   * "You're in" email.
   */
  selection?: SelectionInfo | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const BRAND = "S4DS · KJSIT";

function layout(heading: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:2px solid #111111;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <tr><td style="background:#111111;color:#ffffff;padding:12px 20px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">${BRAND}</td></tr>
  <tr><td style="padding:26px 24px 8px;">
    <h1 style="margin:0;font-size:21px;line-height:1.25;color:#111111;">${escapeHtml(heading)}</h1>
  </td></tr>
  <tr><td style="padding:0 24px 26px;color:#333333;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e5e5e5;color:#777777;font-size:12px;line-height:1.5;">
    Society for Data Science, K J Somaiya Institute of Technology.<br>
    You received this because you registered for an S4DS event.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
  <tr><td style="background:#111111;border-radius:8px;">
    <a href="${url}" style="display:inline-block;padding:13px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

/**
 * The green WhatsApp button used on both "confirmation" and "approved".
 * `cid:whatsapp-icon` is attached in worker.ts whenever this renders — see
 * `emailNeedsWhatsappIcon()` there, which has to agree with this function
 * about when a button actually appears.
 */
function communityButton(group: { url: string; label: string; reason: string }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
    <tr><td style="background:#128C4A;border-radius:8px;padding:11px 22px;">
      <a href="${group.url}" style="display:block;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
        <img src="cid:whatsapp-icon" alt="" width="18" height="18" style="vertical-align:middle;border:0;">
        <span style="vertical-align:middle;">&nbsp;&nbsp;${escapeHtml(group.label)}</span>
      </a>
    </td></tr>
  </table>
  <p style="margin:12px 0 0;font-size:13px;color:#666666;">${escapeHtml(group.reason)}</p>`;
}

/** The form / rulebook / floor-rules list on a selection email. */
function linkList(links: SelectionInfo["links"]) {
  return links
    .map(
      (link) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0 0;border:1px solid #e5e5e5;border-radius:8px;">
  <tr><td style="padding:12px 14px;">
    <a href="${link.url}" style="font-size:15px;font-weight:700;color:#111111;text-decoration:underline;">${escapeHtml(link.label)} &rarr;</a>
    <p style="margin:4px 0 0;font-size:13px;color:#666666;">${escapeHtml(link.note)}</p>
  </td></tr></table>`,
    )
    .join("");
}

function details(payload: TemplatePayload) {
  const rows = [
    ["Event", payload.event_title],
    ["When", payload.event_dates],
    ...(payload.venue ? [["Where", payload.venue]] : []),
    ["Your code", payload.code],
  ];

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0;border:1px solid #e5e5e5;border-radius:8px;">
  ${rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:10px 14px;font-size:13px;color:#777777;${index ? "border-top:1px solid #f0f0f0;" : ""}width:88px;">${escapeHtml(label)}</td>
         <td style="padding:10px 14px;font-size:14px;color:#111111;font-weight:600;${index ? "border-top:1px solid #f0f0f0;" : ""}">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}
</table>`;
}

function textDetails(payload: TemplatePayload) {
  return [
    `Event: ${payload.event_title}`,
    `When:  ${payload.event_dates}`,
    ...(payload.venue ? [`Where: ${payload.venue}`] : []),
    `Code:  ${payload.code}`,
    "",
    `Your ticket: ${payload.ticket_url}`,
  ].join("\n");
}

export function renderEmail(template: TemplateName, payload: TemplatePayload): RenderedEmail {
  const first = payload.name.split(" ")[0];

  switch (template) {
    case "confirmation": {
      // `fee_label` is only set for events that charge a deposit — a free,
      // auto-approved event has already given the registrant a seat, so
      // telling them "we're checking your payment" would just be wrong.
      const awaitingPayment = Boolean(payload.fee_label);
      const subject = `Registered - ${payload.event_title}`;
      const statusLine = payload.pending
        ? awaitingPayment
          ? "Someone from the team is checking your payment. You'll get your ticket and QR code once your registration is approved."
          : "Your registration is under review. We'll email you once it's approved — no ticket or QR yet."
        : awaitingPayment
          ? "Someone from the team is checking your payment. Your QR code goes live once that's done. Keep this link, it's your ticket."
          : "You're confirmed. Keep this link, it's your ticket.";
      return {
        subject,
        html: layout(`You're registered, ${escapeHtml(first)}`, [
          `<p style="margin:0 0 4px;">We've got your registration for <strong>${escapeHtml(payload.event_title)}</strong>.</p>`,
          details(payload),
          `<p style="margin:0;">${statusLine}</p>`,
          button(payload.ticket_url, "Open my ticket"),
          payload.refund_terms
            ? `<p style="margin:0;font-size:13px;color:#666666;">${escapeHtml(payload.refund_terms)}</p>`
            : "",
          payload.community ? communityButton(payload.community) : "",
        ].join("")),
        text: [
          `You're registered, ${first}.`,
          "",
          `We've got your registration for ${payload.event_title}.`,
          "",
          textDetails(payload),
          "",
          statusLine,
          payload.refund_terms ? `\n${payload.refund_terms}` : "",
          payload.community
            ? `\n${payload.community.label}: ${payload.community.url}\n${payload.community.reason}`
            : "",
        ].join("\n"),
      };
    }

    case "waitlisted": {
      return {
        subject: `Waitlisted - ${payload.event_title}`,
        html: layout(`You're on the waitlist, ${escapeHtml(first)}`, [
          `<p style="margin:0 0 4px;">${escapeHtml(payload.event_title)} was full when you signed up, so you're on the waitlist.</p>`,
          details(payload),
          `<p style="margin:0;"><strong>Don't pay anything yet.</strong> If a seat opens we'll email you, and you can pay the deposit then.</p>`,
          button(payload.ticket_url, "Check my place"),
        ].join("")),
        text: [
          `You're on the waitlist, ${first}.`,
          "",
          `${payload.event_title} was full when you signed up.`,
          "",
          textDetails(payload),
          "",
          "Don't pay anything yet. If a seat opens we'll email you.",
        ].join("\n"),
      };
    }

    case "approved": {
      // Every event gets a WhatsApp button here — `community` just lets a
      // specific event point at its own group instead of the default one.
      const group = payload.community ?? {
        url: "https://chat.whatsapp.com/GmtWbCfG65hGl8kPvNRxZZ?s=cl&p=a&ilr=1",
        label: "Join WhatsApp Group",
        reason: "Join our WhatsApp group for further details.",
      };
      // `has_ticket` mirrors event-features.ticket — false means this event
      // issues no QR at all, so showing one here (or telling someone to show
      // it at a door with no scanner) would just be wrong.
      const hasTicket = payload.has_ticket !== false;
      const selection = payload.selection;
      const intro = selection?.intro ?? [
        `Your spot at ${payload.event_title} is confirmed.`,
      ];

      return {
        subject: selection
          ? `Selected - ${payload.event_title}`
          : `You're in - ${payload.event_title}`,
        html: layout(selection ? selection.heading : `You're in, ${escapeHtml(first)}`, [
          selection
            ? `<p style="margin:0 0 12px;">Hi ${escapeHtml(first)},</p>` +
              intro
                .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`)
                .join("")
            : `<p style="margin:0 0 4px;">Your spot at <strong>${escapeHtml(payload.event_title)}</strong> is confirmed.</p>`,
          details(payload),
          selection?.links.length
            ? `<p style="margin:18px 0 0;font-weight:700;color:#111111;">Before the day</p>${linkList(selection.links)}`
            : "",
          // cid:whatsapp-icon is attached in worker.ts whenever this renders.
          communityButton(group),
          selection?.outro?.length
            ? `<div style="margin:18px 0 0;">${selection.outro
                .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`)
                .join("")}</div>`
            : "",
          hasTicket
            ? [
                // cid: points at the attached PNG, so it shows without the
                // recipient having to click "display images".
                `<p style="margin:18px 0 8px;">Show this at the door:</p>
                 <img src="cid:ticket-qr" alt="Your ticket QR code" width="200" height="200" style="display:block;border:8px solid #ffffff;border-radius:8px;">`,
                button(payload.ticket_url, "Open my ticket"),
                `<p style="margin:0;font-size:13px;color:#666666;">Can't see the code? Open the ticket link, it works on any phone.</p>`,
              ].join("")
            : button(payload.ticket_url, "View my registration"),
        ].join("")),
        text: [
          selection ? `${selection.heading}` : `You're in, ${first}.`,
          "",
          ...(selection ? [`Hi ${first},`, ""] : []),
          ...intro.flatMap((line) => [line, ""]),
          textDetails(payload),
          "",
          ...(selection?.links.length
            ? [
                "Before the day:",
                ...selection.links.map((link) => `- ${link.label}: ${link.url}\n  ${link.note}`),
                "",
              ]
            : []),
          `${group.label}: ${group.url}`,
          group.reason,
          "",
          ...(selection?.outro ?? []).flatMap((line) => [line, ""]),
          hasTicket ? "Show the QR on your ticket page at the door." : "",
        ].join("\n"),
      };
    }

    case "rejected": {
      return {
        subject: `About your registration - ${payload.event_title}`,
        html: layout("About your registration", [
          `<p style="margin:0 0 4px;">Hi ${escapeHtml(first)}, we're sorry — we couldn't confirm your registration for <strong>${escapeHtml(payload.event_title)}</strong>.</p>`,
          `<p style="margin:16px 0;padding:12px 14px;background:#f7f7f7;border-radius:8px;font-size:14px;">${escapeHtml(
            payload.reason ?? "This usually means we ran out of seats.",
          )}</p>`,
          `<p style="margin:0 0 12px;">We know that's disappointing, and we'd rather have had you there.</p>`,
          `<p style="margin:0;">If you think that's a mistake, reply to this email and we'll sort it out. Either way, we'll announce the next event soon and we'd love to see you at it.</p>`,
        ].join("")),
        text: [
          `Hi ${first},`,
          "",
          `We're sorry — we couldn't confirm your registration for ${payload.event_title}.`,
          "",
          payload.reason ?? "This usually means we ran out of seats.",
          "",
          "We know that's disappointing, and we'd rather have had you there.",
          "",
          "If you think that's a mistake, reply to this email and we'll sort it out.",
          "Either way, we'll announce the next event soon and we'd love to see you at it.",
        ].join("\n"),
      };
    }

    case "ticket": {
      return {
        subject: `Your ticket - ${payload.event_title}`,
        html: layout("Here's your ticket", [
          details(payload),
          button(payload.ticket_url, "Open my ticket"),
        ].join("")),
        text: [`Here's your ticket.`, "", textDetails(payload)].join("\n"),
      };
    }

    case "certificate": {
      return {
        subject: `Your Certificate - ${payload.event_title}`,
        html: layout("Certificate of Participation", [
          `<p style="margin:0 0 4px;">Hi ${escapeHtml(first)},</p>`,
          `<p style="margin:0 0 12px;">Thank you for attending <strong>${escapeHtml(payload.event_title)}</strong>. We are thrilled to have had you with us!</p>`,
          `<p style="margin:0;">Please find your certificate attached to this email.</p>`,
        ].join("")),
        text: [
          `Hi ${first},`,
          "",
          `Thank you for attending ${payload.event_title}. We are thrilled to have had you with us!`,
          "",
          "Please find your certificate attached to this email.",
        ].join("\n"),
      };
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
