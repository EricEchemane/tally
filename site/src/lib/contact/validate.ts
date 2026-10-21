/**
 * Contact form input rules, shared by the browser (instant inline errors) and the server action (the real check).
 * Pure: no Node or browser APIs, so it runs in both and under `node --test`.
 */

export const TOPICS = {
  question: "A question about Tally",
  pilot: "A pilot for my team",
  misread: "A receipt Tally got wrong",
  other: "Something else",
} as const;
export type Topic = keyof typeof TOPICS;

/** Own keys only: `"__proto__" in TOPICS` is true, which would let a crafted topic through. */
export function isTopic(value: string): value is Topic {
  return Object.prototype.hasOwnProperty.call(TOPICS, value);
}

export const LIMITS = { name: 80, email: 254, message: 4000, messageMin: 10, links: 5 } as const;

export type ContactFields = { topic: Topic; name: string; email: string; message: string };
export type FieldName = keyof ContactFields;
export type FieldErrors = Partial<Record<FieldName, string>>;

export type Validation = { ok: true; fields: ContactFields } | { ok: false; errors: FieldErrors; fields: Raw };
type Raw = { topic: string; name: string; email: string; message: string };

// Zero-width and bidirectional control characters: invisible, and in an email they can reorder or hide text.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
// C0/C1 control characters except tab and newline. Newlines are kept only in the message.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
const LINKS = /\b(?:https?:\/\/|www\.)\S+/gi;
const HAS_LINK = /\b(?:https?:\/\/|www\.)\S+/i;
// One @, a dot in the domain, no spaces or angle brackets. Deliberately simple; the server also checks the
// domain can receive mail.
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/** Normalises one line of text: no control characters, no line breaks, collapsed spaces. */
export function cleanLine(s: string) {
  return s.normalize("NFC").replace(INVISIBLE, "").replace(CONTROL, "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Normalises free text: keeps paragraphs, drops control characters, caps runs of blank lines at one. */
export function cleanText(s: string) {
  return s
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function readFields(form: FormData): Raw {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  return { topic: get("topic"), name: get("name"), email: get("email"), message: get("message") };
}

export function validateContact(raw: Raw): Validation {
  const fields = {
    topic: raw.topic,
    name: cleanLine(raw.name),
    email: cleanLine(raw.email).toLowerCase(),
    message: cleanText(raw.message),
  };
  const errors: FieldErrors = {};

  if (!isTopic(fields.topic)) errors.topic = "Choose what this is about.";

  if (!fields.name) errors.name = "Enter your name.";
  else if (fields.name.length > LIMITS.name) errors.name = `Keep your name under ${LIMITS.name} characters.`;
  // The name is the one visitor-written text that reaches the visitor's own inbox (in the greeting), so it may not
  // carry links or addresses that would turn the confirmation email into an advert.
  else if (HAS_LINK.test(fields.name) || /[@<>]|\.(?:com|net|org|io|ru|cn|xyz)\b/i.test(fields.name)) {
    errors.name = "Enter just your name.";
  }

  if (!fields.email) errors.email = "Enter your email so we can reply.";
  else if (fields.email.length > LIMITS.email || !EMAIL.test(fields.email)) {
    errors.email = "That email address doesn't look right.";
  }

  if (!fields.message) errors.message = "Write your message.";
  else if (fields.message.length < LIMITS.messageMin) errors.message = "Tell us a little more.";
  else if (fields.message.length > LIMITS.message) {
    errors.message = `Keep it under ${LIMITS.message.toLocaleString("en-US")} characters.`;
  } else if ((fields.message.match(LINKS) ?? []).length > LIMITS.links) {
    errors.message = `Please include no more than ${LIMITS.links} links.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, fields: { ...raw, ...fields } };
  return { ok: true, fields: fields as ContactFields };
}

/** For logs: enough to recognise a sender, not enough to harvest the address. */
export function maskEmail(email: string) {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}
