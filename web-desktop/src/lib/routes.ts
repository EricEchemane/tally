// The desktop build is a static export, so pages take their ID from the query string
// (/liquidations/?id=5) instead of the path (/liquidations/5). Keep every link going through here.
export const liquidationHref = (id: number) => `/liquidations/?id=${id}`;
export const receiptHref = (id: number) => `/receipts/?id=${id}`;

/** Links written by the API (Ask Tally answers) still use path IDs; map them to the export's pages. */
export function pageHref(href: string): string {
  const m = href.match(/^\/(liquidations|receipts)\/(\d+)\/?$/);
  return m ? `/${m[1]}/?id=${m[2]}` : href;
}
