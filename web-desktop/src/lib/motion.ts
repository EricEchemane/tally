"use client";
// Small motion helpers. CSS does the animating (globals.css); these only decide when.
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Counts changes of `value` after the first render: use it as a React key to replay a CSS animation. */
export function useChangeCount<T>(value: T): number {
  const first = useRef(true);
  const prev = useRef(value);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (prev.current !== value) setN((x) => x + 1);
    prev.current = value;
  }, [value]);
  return n;
}

/** "up" / "down" for a moment after a number changes (not on first render), then null. */
export function useDirection(value: number | null | undefined, ms = 1100): "up" | "down" | null {
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before == null || value == null || before === value) return;
    setDir(value > before ? "up" : "down");
    const t = setTimeout(() => setDir(null), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dir;
}

/** Position of the active option inside a segmented control, for a highlight that slides between options.
 *  The active option is the child marked data-active="true". */
export function useIndicator(ref: RefObject<HTMLElement | null>, activeKey: unknown) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const a = el.querySelector<HTMLElement>('[data-active="true"]');
      setBox(a ? { left: a.offsetLeft, top: a.offsetTop, width: a.offsetWidth, height: a.offsetHeight } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, activeKey]);
  return box;
}
