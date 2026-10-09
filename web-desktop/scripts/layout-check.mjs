// Layout check: measures every dashboard page in WebKit (the engine of the Mac app's window) and fails
// when the spacing rules in DESIGN.md drift. Run after `next build`:  npm run check:layout
//
// Rules checked, at two window widths:
//   edges    the top bar and the page title share one left edge (the PAGE column)
//   title    every page's title starts at the same height
//   inset    text inside cards sits 24 px from the card edge: card titles, list rows, table cells
// --shots <dir> also saves a screenshot of each page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { webkit } from "playwright-core";
import { startBackend } from "./ui-backend.mjs";

const PAGES = ["/", "/overview/", "/employees/", "/settings/", "/liquidations/?id=1", "/receipts/?id=1"];
const WIDTHS = [1280, 1600];
const INSET = 24; // DESIGN.md: card inset
const TOLERANCE = 1.5; // the card's 1 px border and sub-pixel rounding

const shotsDir = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const { url, stop } = await startBackend();
const browser = await webkit.launch();
const problems = [];
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const titleTops = new Map();
    for (const path of PAGES) {
      await page.goto(url + path);
      await page.waitForSelector("main h1");
      await page.waitForTimeout(800); // data loads and entrance animations settle
      if (shotsDir) await page.screenshot({ path: join(shotsDir, `${width}${path.replace(/[/?=]+/g, "_")}.png`), fullPage: true });
      const m = await page.evaluate((INSET) => {
        const box = (el) => el.getBoundingClientRect();
        const bar = document.querySelector("header > div > div");
        const h1 = document.querySelector("main h1");
        const insets = [];
        for (const card of document.querySelectorAll("main section")) {
          const left = box(card).left;
          const at = (el, what) => {
            const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
            insets.push({ what, inset: Math.round((box(el).left + pad - left) * 10) / 10 });
          };
          const h2 = card.querySelector(":scope > header h2");
          if (h2) insets.push({ what: `card title "${h2.textContent}"`, inset: Math.round((box(h2).left - left) * 10) / 10 });
          const li = card.querySelector(":scope > ul > li, :scope > div > ul > li");
          if (li) {
            // A row may carry its padding itself or on the link that fills it.
            const padded = parseFloat(getComputedStyle(li).paddingLeft) ? li : li.firstElementChild ?? li;
            at(padded, "first list row");
          }
          const td = card.querySelector("tbody td");
          if (td) at(td, "first table cell");
        }
        return { barLeft: bar ? box(bar).left : null, titleLeft: box(h1).left, titleTop: box(h1).top, insets };
      }, INSET);
      const where = `${width}px ${path}`;
      if (m.barLeft !== null && Math.abs(m.barLeft - m.titleLeft) > TOLERANCE)
        problems.push(`${where}: top bar edge ${m.barLeft}px but page title at ${m.titleLeft}px`);
      titleTops.set(path, m.titleTop);
      for (const { what, inset } of m.insets)
        if (Math.abs(inset - INSET) > TOLERANCE) problems.push(`${where}: ${what} is ${inset}px from the card edge, not ${INSET}px`);
    }
    const tops = [...titleTops.values()];
    if (Math.max(...tops) - Math.min(...tops) > TOLERANCE)
      problems.push(`${width}px: page titles start at different heights: ${[...titleTops].map(([p, t]) => `${p} ${t}px`).join(", ")}`);
    await page.close();
  }
} finally {
  await browser.close();
  stop();
}

if (problems.length) {
  console.error(`Layout check failed (${problems.length}):\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`Layout check passed: ${PAGES.length} pages at ${WIDTHS.join(" and ")} px.`);
