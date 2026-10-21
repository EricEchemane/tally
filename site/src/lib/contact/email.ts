/**
 * The two contact emails, as HTML and plain text. Email clients ignore most CSS, so the HTML is table-based with
 * inline styles, a fixed light palette (Gmail and Outlook dark modes invert it on their own), and system fonts.
 * Every visitor-written value passes through `esc` before it lands in markup.
 */

export type Site = { url: string; host: string; logoUrl?: string; demoUrl: string };

const C = {
  page: "#f6f5f0",
  card: "#ffffff",
  night: "#0f2b26",
  lime: "#c5f06a",
  mint: "#edf6e8",
  forest: "#1d5c43",
  ink: "#1b1f1c",
  muted: "#5d655f",
  faint: "#8a918b",
  line: "#e2dfd6",
};
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Escaped text with its line breaks kept; Outlook ignores white-space: pre-wrap, so breaks become <br>. */
function paragraphs(s: string) {
  return esc(s).replace(/\n/g, "<br>");
}

export function firstName(name: string) {
  return name.split(/\s+/)[0].slice(0, 40);
}

export function formatManila(d: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:999px;background:${C.night};">
<a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${C.lime};text-decoration:none;border-radius:999px;">${label}</a>
</td></tr></table>`;
}

/** The shared frame: a hidden preheader, the dark brand band, a white card, and a quiet footer. */
function layout({ preheader, badge, body, footer, site }: { preheader: string; badge: string; body: string; footer: string; site: Site }) {
  const mark = site.logoUrl
    ? `<img src="${esc(site.logoUrl)}" width="28" height="28" alt="" style="display:block;border:0;border-radius:7px;">`
    : "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Tally</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="background:${C.night};border-radius:20px 20px 0 0;padding:20px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-family:${FONT};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${mark ? `<td style="padding-right:10px;">${mark}</td>` : ""}
        <td style="font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">Tally</td>
      </tr></table>
    </td>
    <td align="right"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${C.lime};color:${C.night};font-family:${FONT};font-size:12px;font-weight:600;">${badge}</span></td>
  </tr></table>
</td></tr>
<tr><td style="background:${C.card};border-radius:0 0 20px 20px;padding:32px 28px 28px;font-family:${FONT};color:${C.ink};">
${body}
</td></tr>
<tr><td style="padding:20px 28px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint};text-align:center;">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.4px;color:${C.ink};">${text}</h1>`;
}

function p(html: string, extra = "") {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.muted};${extra}">${html}</p>`;
}

function metaRow(label: string, value: string) {
  return `<tr>
<td style="padding:10px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;color:${C.faint};width:84px;vertical-align:top;">${label}</td>
<td style="padding:10px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.ink};vertical-align:top;">${value}</td>
</tr>`;
}

export type Message = { topicLabel: string; name: string; email: string; message: string; sentAt: Date };

/** To us: who wrote, about what, the message itself, and a one-click reply. */
export function ownerEmail(m: Message, site: Site) {
  const first = firstName(m.name);
  const when = formatManila(m.sentAt);
  const replyHref = `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topicLabel}`)}`;

  const body = `
${h1(`${esc(m.name)} wrote in`)}
<p style="margin:0 0 24px;"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${C.mint};color:${C.forest};font-family:${FONT};font-size:13px;font-weight:600;">${esc(m.topicLabel)}</span></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
${metaRow("From", esc(m.name))}
${metaRow("Email", `<a href="mailto:${esc(m.email)}" style="color:${C.forest};text-decoration:underline;">${esc(m.email)}</a>`)}
${metaRow("Sent", `${esc(when)} (Manila)`)}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
<tr><td style="background:${C.page};border-left:3px solid ${C.forest};border-radius:4px 12px 12px 4px;padding:18px 20px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.ink};">
${paragraphs(m.message)}
</td></tr></table>
${button(replyHref, `Reply to ${esc(first)}`)}`;

  const footer = `Sent from the contact form on ${esc(site.host)}. Replying to this email goes straight to ${esc(m.email)}.`;

  return {
    subject: `${m.topicLabel}: ${m.name}`,
    html: layout({ preheader: m.message.slice(0, 120), badge: "New message", body, footer, site }),
    text: `${m.name} wrote in about: ${m.topicLabel}

From:  ${m.name}
Email: ${m.email}
Sent:  ${when} (Manila)

${m.message}

Reply to this email to answer ${first} directly.`,
  };
}

/**
 * To the visitor: a short acknowledgement. It repeats only their first name and the topic they picked from our list,
 * never their message, so the form can't be used to deliver someone else's text from our address.
 */
export function visitorEmail(m: Pick<Message, "name" | "topicLabel" | "sentAt">, site: Site) {
  const first = firstName(m.name);
  const when = formatManila(m.sentAt);

  const body = `
${h1(`Thanks, ${esc(first)}. We got your message.`)}
${p(`You wrote to us about <strong style="color:${C.ink};font-weight:600;">${esc(m.topicLabel.toLowerCase())}</strong>. We read every message ourselves and will reply to this email address.`)}
${p("There's nothing else you need to do. If you think of something to add, just reply to this email.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;">
<tr><td style="background:${C.mint};border-radius:14px;padding:20px 22px;font-family:${FONT};">
  <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${C.forest};text-transform:uppercase;letter-spacing:0.6px;">While you wait</p>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink};">See Tally check a Liquidation's receipts, offline on a laptop, in 40 seconds.</p>
  ${button(site.demoUrl, "Watch the demo")}
</td></tr></table>
${p(`Eric<br><span style="color:${C.faint};">Tally</span>`, "margin:0;")}`;

  const footer = `You're getting this because this address was entered on the contact form at
<a href="${esc(site.url)}" style="color:${C.faint};">${esc(site.host)}</a> on ${esc(when)}.
If that wasn't you, ignore this email. We won't write again unless you reply.`;

  return {
    subject: "We got your message",
    html: layout({ preheader: "Thanks for writing. We'll reply to this address.", badge: "Message received", body, footer, site }),
    text: `Thanks, ${first}. We got your message.

You wrote to us about ${m.topicLabel.toLowerCase()}. We read every message ourselves and will reply to this email address. If you think of something to add, just reply.

While you wait, watch the demo: ${site.demoUrl}

Eric
Tally

--
You're getting this because this address was entered on the contact form at ${site.host} on ${when}. If that wasn't you, ignore this email. We won't write again unless you reply.`,
  };
}
