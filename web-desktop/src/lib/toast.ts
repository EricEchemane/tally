// Confirm an action with a toast: toast("Liquidation approved", { body: "Totals are now frozen." }).
// <Toasts> in the app shell shows them; downloads report through the same list.
export type ToastTone = "ok" | "bad" | "info";
export type ToastDetail = { title: string; body?: string; tone?: ToastTone };

export function toast(title: string, opts: { body?: string; tone?: ToastTone } = {}) {
  window.dispatchEvent(new CustomEvent<ToastDetail>("tally:toast", { detail: { title, ...opts } }));
}
