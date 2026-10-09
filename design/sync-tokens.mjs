// Copies design/tokens.css into each Next.js app. Turbopack will not import CSS from outside an
// app's own folder (and symlinks break on Windows), so each app commits its own copy.
//   node design/sync-tokens.mjs          write the copies
//   node design/sync-tokens.mjs --check  exit 1 if any copy differs from design/tokens.css
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const designDir = dirname(fileURLToPath(import.meta.url));
const repo = join(designDir, "..");
const source = join(designDir, "tokens.css");
const apps = ["web", "site"];
const header =
  "/* Generated from design/tokens.css by design/sync-tokens.mjs. Edit that file, then run\n" +
  "   `node design/sync-tokens.mjs`. */\n";

const expected = header + readFileSync(source, "utf8");
const check = process.argv.includes("--check");
let stale = 0;

for (const app of apps) {
  if (!existsSync(join(repo, app, "package.json"))) continue;
  const target = join(repo, app, "src", "app", "tokens.css");
  const name = relative(repo, target).replaceAll("\\", "/");
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === expected) continue;
  if (check) {
    console.error(`${name} is out of date: run node design/sync-tokens.mjs`);
    stale++;
  } else {
    writeFileSync(target, expected);
    console.log(`wrote ${name}`);
  }
}

process.exit(stale ? 1 : 0);
