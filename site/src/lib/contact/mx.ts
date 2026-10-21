import { resolve4, resolve6, resolveMx } from "node:dns/promises";

const TIMEOUT_MS = 3_000;

function withTimeout<T>(p: Promise<T>) {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

const MISSING = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

/**
 * Whether the domain of an address can receive mail: it has MX records (and not the "null MX" that RFC 7505 uses
 * to say "no mail here"), or, failing that, an address record (RFC 5321 falls back to it). Fails open: a slow or
 * broken resolver never blocks a real visitor.
 */
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const mx = await withTimeout(resolveMx(domain));
    if (mx.length === 0) return false;
    return !(mx.length === 1 && (mx[0].exchange === "" || mx[0].exchange === "."));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "";
    if (!MISSING.has(code)) return true;
    if (code === "ENOTFOUND" || code === "NXDOMAIN") return false;
    // The domain exists but has no MX: accept it if it has an address to deliver to.
    const found = await Promise.any([withTimeout(resolve4(domain)), withTimeout(resolve6(domain))]).catch(() => []);
    return found.length > 0;
  }
}
