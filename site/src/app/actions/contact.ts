"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import nodemailer, { type Transporter } from "nodemailer";
import { ownerEmail, visitorEmail, type Site } from "@/lib/contact/email";
import { domainAcceptsMail } from "@/lib/contact/mx";
import { SeenSet, Throttle } from "@/lib/contact/throttle";
import { checkToken, issueToken, MAX_AGE_MS } from "@/lib/contact/token";
import { maskEmail, readFields, TOPICS, validateContact, type FieldErrors } from "@/lib/contact/validate";
import { DEMO_VIDEO_WATCH_URL, SITE_URL } from "@/lib/links";

export type ContactState = {
  status: "idle" | "sent" | "error";
  /** A message for the whole form, shown above the button. */
  message?: string;
  errors?: FieldErrors;
  /** What the visitor typed, so a failed send doesn't wipe the form. */
  fields?: { topic: string; name: string; email: string; message: string };
  /** Set when a confirmation email is on its way to this address. */
  confirmationTo?: string;
};

const HOUR = 60 * 60 * 1000;
// Per sender IP, across the whole site, and per address we'd send a confirmation to. The last one stops the form
// from being used to flood someone else's inbox: past it, we still get the message but the visitor isn't emailed.
const perIp = new Throttle(5, 10 * 60 * 1000);
const siteWide = new Throttle(40, HOUR);
const perRecipient = new Throttle(2, 24 * HOUR);
const usedTokens = new SeenSet(MAX_AGE_MS);

/**
 * The form token's signing key. CONTACT_SECRET when set; otherwise one derived from the SMTP password, so the
 * form works with only the SMTP settings and the key still never appears in the client.
 */
function secret() {
  const explicit = process.env.CONTACT_SECRET;
  if (explicit) return explicit;
  const pass = process.env.SMTP_PASS;
  if (!pass) throw new Error("Contact form: set CONTACT_SECRET or SMTP_PASS");
  return createHash("sha256").update(`tally-contact-form:${pass}`).digest("hex");
}

let transport: Transporter | undefined;
function mailer() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // Port 587 starts plain and upgrades; refuse to send if the upgrade doesn't happen.
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

function site(): Site {
  const url = new URL(SITE_URL);
  return {
    url: url.origin,
    host: url.host,
    // Email clients can't load images from localhost, so the logo only goes in from a real deployment.
    logoUrl: url.protocol === "https:" ? `${url.origin}/logo.png` : undefined,
    demoUrl: DEMO_VIDEO_WATCH_URL,
  };
}

function reject(reason: string): ContactState {
  console.warn(`Contact form: rejected (${reason})`);
  return { status: "error", message: "Something went wrong. Please reload the page and try again." };
}

/** Called once when the form appears: hands the browser a signed, timestamped token to send back with the message. */
export async function startContact(): Promise<string> {
  return issueToken(secret());
}

export async function sendContact(_: ContactState, form: FormData): Promise<ContactState> {
  const raw = readFields(form);
  const keep = { fields: raw };

  // Honeypot: a field people never see. Bots fill it in; tell them it worked and send nothing.
  if (form.get("ref_code")) {
    console.warn("Contact form: rejected (honeypot)");
    return { status: "sent" };
  }

  const token = checkToken(secret(), String(form.get("token") ?? ""));
  if (!token.ok) {
    if (token.reason === "too-fast") {
      return { status: "error", message: "That was quick. Give it a second and send again.", ...keep };
    }
    if (token.reason === "expired") {
      return { status: "error", message: "This page has been open a while. Reload it and send again.", ...keep };
    }
    return { ...reject(`token ${token.reason}`), ...keep };
  }

  const v = validateContact(raw);
  if (!v.ok) return { status: "error", errors: v.errors, fields: v.fields };
  const { fields } = v;

  // Counted after validation, so a visitor fixing typos doesn't use up their allowance.
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (perIp.hit(ip) || siteWide.hit("all")) {
    console.warn("Contact form: rejected (rate limit)");
    return { status: "error", message: "We've had a lot of messages just now. Please try again in a few minutes.", fields };
  }

  if (!(await domainAcceptsMail(fields.email))) {
    return { status: "error", errors: { email: "We can't deliver to that address. Check the spelling." }, fields };
  }

  // Spend the token only once the message is otherwise good, so fixing a typo doesn't need a reload.
  if (usedTokens.use(token.nonce)) return { ...reject("token reused"), ...keep };

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const to = process.env.CONTACT_TO ?? process.env.SMTP_USER;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !to) {
    console.error("Contact form: SMTP is not configured");
    return { status: "error", message: "The contact form isn't available right now. Please try again later.", fields };
  }

  const s = site();
  const sentAt = new Date();
  const topicLabel = TOPICS[fields.topic];
  const owner = ownerEmail({ ...fields, topicLabel, sentAt }, s);
  try {
    await mailer().sendMail({
      from,
      to,
      replyTo: { name: fields.name, address: fields.email },
      subject: owner.subject,
      text: owner.text,
      html: owner.html,
    });
  } catch (err) {
    console.error("Contact form: send failed", (err as Error).message);
    return { status: "error", message: "Your message didn't go through. Please try again in a moment.", fields };
  }

  if (perRecipient.hit(fields.email)) {
    console.warn(`Contact form: confirmation skipped for ${maskEmail(fields.email)} (recipient limit)`);
    return { status: "sent" };
  }

  // The confirmation goes out after the response, so the visitor isn't kept waiting on a second SMTP round trip.
  const visitor = visitorEmail({ name: fields.name, topicLabel, sentAt }, s);
  after(async () => {
    try {
      await mailer().sendMail({
        from,
        to: { name: fields.name, address: fields.email },
        subject: visitor.subject,
        text: visitor.text,
        html: visitor.html,
        // Tells mail servers this is an automatic reply, so out-of-office responders don't answer it.
        headers: { "Auto-Submitted": "auto-replied", "X-Auto-Response-Suppress": "All" },
      });
    } catch (err) {
      console.error(`Contact form: confirmation to ${maskEmail(fields.email)} failed`, (err as Error).message);
    }
  });

  return { status: "sent", confirmationTo: fields.email };
}
