import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { esc, firstName, ownerEmail, visitorEmail, type Site } from "./email.ts";
import { SeenSet, Throttle } from "./throttle.ts";
import { checkToken, issueToken, MAX_AGE_MS, MIN_AGE_MS } from "./token.ts";
import { cleanLine, cleanText, maskEmail, validateContact } from "./validate.ts";

const good = { topic: "question", name: "Maria Santos", email: "maria@example.com", message: "Does Tally work on Windows 10?" };

describe("validateContact", () => {
  test("accepts a normal message and normalises it", () => {
    const v = validateContact({ ...good, name: "  Maria​  Santos ", email: " Maria@Example.COM " });
    assert.equal(v.ok, true);
    assert.deepEqual(v.ok && v.fields, { ...good, name: "Maria Santos", email: "maria@example.com" });
  });

  test("requires every field", () => {
    const v = validateContact({ topic: "", name: "", email: "", message: "" });
    assert.equal(v.ok, false);
    assert.deepEqual(Object.keys(!v.ok ? v.errors : {}).sort(), ["email", "message", "name", "topic"]);
  });

  test("rejects topics outside the list", () => {
    for (const topic of ["sales", "__proto__", "constructor", "toString"]) {
      assert.equal(validateContact({ ...good, topic }).ok, false, topic);
    }
  });

  test("rejects malformed and header-injecting emails", () => {
    for (const email of ["maria", "maria@", "@example.com", "maria@example", "a b@example.com", "maria@example.com\r\nBcc: x@y.z", "<maria@example.com>", "maria@-bad.com"]) {
      const v = validateContact({ ...good, email });
      assert.equal(v.ok, false, email);
    }
  });

  test("strips line breaks from the name so it can't break an email header", () => {
    const v = validateContact({ ...good, name: "Maria\r\nBcc: victim@example.com" });
    assert.equal(v.ok, false); // contains "@", rejected outright
    assert.equal(cleanLine("Maria\r\nSantos"), "Maria Santos");
  });

  test("refuses links and domains in the name, which reaches the visitor's inbox", () => {
    for (const name of ["Visit https://spam.example", "www.spam.example", "Cheap pills.com", "<b>Maria</b>"]) {
      assert.equal(validateContact({ ...good, name }).ok, false, name);
    }
  });

  test("limits message length and link count", () => {
    assert.equal(validateContact({ ...good, message: "hi" }).ok, false);
    assert.equal(validateContact({ ...good, message: "x".repeat(4001) }).ok, false);
    const links = Array.from({ length: 6 }, (_, i) => `https://e.com/${i}`).join(" ");
    assert.equal(validateContact({ ...good, message: links }).ok, false);
    assert.equal(validateContact({ ...good, message: links.split(" ").slice(0, 5).join(" ") }).ok, true);
  });

  test("cleans control and bidi characters but keeps paragraphs", () => {
    assert.equal(cleanText("Hello‮evil\u0007\r\n\r\n\r\n\r\nBye  "), "Helloevil\n\nBye");
  });

  test("masks emails for logs", () => {
    assert.equal(maskEmail("maria@example.com"), "ma***@example.com");
  });
});

describe("form token", () => {
  const secret = "test-secret";
  const t0 = 1_760_000_000_000;

  test("accepts a token after the minimum time", () => {
    const check = checkToken(secret, issueToken(secret, t0), t0 + MIN_AGE_MS);
    assert.equal(check.ok, true);
  });

  test("rejects a token used too fast or too late", () => {
    const token = issueToken(secret, t0);
    assert.deepEqual(checkToken(secret, token, t0 + 500), { ok: false, reason: "too-fast" });
    assert.deepEqual(checkToken(secret, token, t0 + MAX_AGE_MS + 1), { ok: false, reason: "expired" });
  });

  test("rejects forged, tampered and malformed tokens", () => {
    const token = issueToken(secret, t0);
    const later = t0 + 10_000;
    assert.deepEqual(checkToken("other-secret", token, later), { ok: false, reason: "signature" });
    const [, nonce, mac] = token.split(".");
    assert.deepEqual(checkToken(secret, `${t0 - 60_000}.${nonce}.${mac}`, later), { ok: false, reason: "signature" });
    for (const bad of ["", "abc", "1.2.3", `${t0}.${nonce}`, `${t0}..${mac}`]) {
      assert.equal(checkToken(secret, bad, later).ok, false, bad);
    }
  });

  test("gives every token its own nonce", () => {
    const a = checkToken(secret, issueToken(secret, t0), t0 + 5_000);
    const b = checkToken(secret, issueToken(secret, t0), t0 + 5_000);
    assert.ok(a.ok && b.ok && a.nonce !== b.nonce);
  });
});

describe("Throttle and SeenSet", () => {
  test("allows up to the limit within the window, then blocks", () => {
    const t = new Throttle(2, 1_000);
    assert.equal(t.hit("ip", 0), false);
    assert.equal(t.hit("ip", 100), false);
    assert.equal(t.hit("ip", 200), true);
    assert.equal(t.hit("other", 200), false);
    assert.equal(t.hit("ip", 1_250), false); // the first two hits have aged out
  });

  test("refuses a value seen before, until it expires", () => {
    const s = new SeenSet(1_000);
    assert.equal(s.use("n1", 0), false);
    assert.equal(s.use("n1", 500), true);
    assert.equal(s.use("n1", 1_500), false);
  });
});

describe("emails", () => {
  const site: Site = { url: "https://tally.example", host: "tally.example", logoUrl: "https://tally.example/logo.png", demoUrl: "https://youtu.be/x" };
  const evil = {
    topicLabel: "A question about Tally",
    name: `Eve <script>alert(1)</script>`,
    email: "eve@example.com",
    message: `<img src=x onerror=alert(1)>\nSecond line & more`,
    sentAt: new Date("2026-10-21T02:30:00Z"),
  };

  test("escapes everything the visitor wrote", () => {
    const { html } = ownerEmail(evil, site);
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img src=x"));
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;<br>Second line &amp; more"));
    assert.equal(esc(`"'&<>`), "&quot;&#39;&amp;&lt;&gt;");
  });

  test("owner email offers a reply to the visitor and shows Manila time", () => {
    const { html, text, subject } = ownerEmail({ ...evil, name: "Maria Santos" }, site);
    assert.equal(subject, "A question about Tally: Maria Santos");
    assert.ok(html.includes("mailto:eve@example.com?subject=Re%3A%20A%20question%20about%20Tally"));
    assert.ok(html.includes("Reply to Maria"));
    assert.match(text, /10:30/);
  });

  test("visitor email never repeats the message", () => {
    const { html, text } = visitorEmail(evil, site);
    assert.ok(!html.includes("onerror") && !text.includes("onerror"));
    assert.ok(!html.includes("Second line") && !text.includes("Second line"));
    assert.ok(html.includes("If that wasn&#39;t you") || html.includes("If that wasn't you"));
  });

  test("omits the logo when there is no public URL for it", () => {
    const { html } = visitorEmail(evil, { ...site, logoUrl: undefined });
    assert.ok(!html.includes("<img"));
  });

  test("greets by a short first name", () => {
    assert.equal(firstName("Maria Clara Santos"), "Maria");
    assert.equal(firstName("x".repeat(60)).length, 40);
  });
});
