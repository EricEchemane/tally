// A throwaway Tally backend for checking the UI: demo data, the fake AI pipeline, setup already done,
// a fresh temp data folder and any free port. It serves the last `next build` (web-desktop/out).
//
//   node scripts/ui-backend.mjs            # prints the URL, runs until Ctrl-C
//   import { startBackend } from "./ui-backend.mjs"   // from another script: { url, stop }
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "api");

/** `extraEnv` adjusts the backend, e.g. { OLLAMA_URL: "http://127.0.0.1:9", TALLY_OLLAMA_SEARCH: "" } for a
 *  machine with no receipt reader installed. */
export function startBackend(extraEnv = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), "tally-ui-"));
  writeFileSync(join(dataDir, "setup.json"), JSON.stringify({ complete: true }));
  const child = spawn("uv", ["run", "python", "desktop.py", "--data-dir", dataDir, "--port", "0"], {
    cwd: API,
    env: { ...process.env, TALLY_SEED: "demo", TALLY_FAKE_PIPELINE: "1", TALLY_FAKE_DELAY: "0.2", ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"],
  });
  // Quiet unless it fails to start: request logs would bury the caller's own output.
  let log = "";
  child.stderr.on("data", (b) => { log = (log + b).slice(-4000); });
  const stop = () => child.stdin.end(); // the backend exits when stdin closes
  return new Promise((resolve, reject) => {
    child.on("exit", (code) => reject(new Error(`backend exited (${code}) before it was ready:\n${log}`)));
    child.stdout.on("data", async (buf) => {
      const m = String(buf).match(/TALLY_READY port=(\d+)/);
      if (!m) return;
      const url = `http://127.0.0.1:${m[1]}`;
      for (let i = 0; i < 80; i++) {
        try { if ((await fetch(`${url}/api/setup/pending`)).ok) return resolve({ url, stop }); } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }
      reject(new Error("backend never answered"));
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url, stop } = await startBackend();
  console.log(`Tally UI backend: ${url}  (demo data, fake AI; Ctrl-C to stop)`);
  process.on("SIGINT", () => { stop(); process.exit(0); });
}
