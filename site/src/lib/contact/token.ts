import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A signed "form opened at" stamp. The browser asks for one when the form appears and sends it back with the
 * message. It proves the sender loaded the form (a script can't mint one without the secret), that a person had
 * time to type (MIN_AGE), and that the page isn't stale (MAX_AGE). Each token also carries a random nonce, so a
 * caller can refuse a token it has already seen.
 */
export const MIN_AGE_MS = 3_000;
export const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type TokenCheck = { ok: true; nonce: string } | { ok: false; reason: "malformed" | "signature" | "too-fast" | "expired" };

function sign(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueToken(secret: string, now = Date.now()) {
  const payload = `${now}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function checkToken(secret: string, token: string, now = Date.now()): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !parts[1] || !parts[2]) return { ok: false, reason: "malformed" };

  const [issued, nonce, mac] = parts;
  const expected = Buffer.from(sign(secret, `${issued}.${nonce}`));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "signature" };

  const age = now - Number(issued);
  if (age < MIN_AGE_MS) return { ok: false, reason: "too-fast" };
  if (age > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true, nonce };
}
