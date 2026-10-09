"use client";
// Adapted from Magic UI's Animated Beam (magicui.design/r/animated-beam.json, via the magicui MCP).
// Changes for this site, per design-motion-principles: it plays once when it scrolls into view instead of
// looping, takes its colour from the page tokens instead of a purple/orange gradient, and under reduced
// motion it draws the path as a still line.
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useState, type RefObject } from "react";

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  delay = 0,
  duration = 1.6,
  color = "var(--accent-ink)",
}: {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  delay?: number;
  duration?: number;
  color?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const inView = useInView(containerRef, { once: true, amount: 0.6 });
  const [path, setPath] = useState({ d: "", w: 0, h: 0, horizontal: true });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const a = fromRef.current?.getBoundingClientRect();
      const b = toRef.current?.getBoundingClientRect();
      const box = container.getBoundingClientRect();
      if (!a || !b) return;
      const x1 = a.left - box.left + a.width / 2;
      const y1 = a.top - box.top + a.height / 2;
      const x2 = b.left - box.left + b.width / 2;
      const y2 = b.top - box.top + b.height / 2;
      setPath({ d: `M ${x1},${y1} L ${x2},${y2}`, w: box.width, h: box.height, horizontal: Math.abs(x2 - x1) > Math.abs(y2 - y1) });
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();
    return () => observer.disconnect();
  }, [containerRef, fromRef, toRef]);

  // The highlight is a short band that slides along the line's main axis, once. Coordinates are in the
  // SVG's own space (a straight line has a zero-height box, which objectBoundingBox cannot paint).
  const [a, b] = path.horizontal ? (["x1", "x2"] as const) : (["y1", "y2"] as const);
  const [c, d] = path.horizontal ? (["y1", "y2"] as const) : (["x1", "x2"] as const);
  const start = { [a]: "-20%", [b]: "0%", [c]: "0%", [d]: "0%" };
  const end = { [a]: "100%", [b]: "120%", [c]: "0%", [d]: "0%" };
  const play = inView && !reduce;

  return (
    <svg
      aria-hidden
      fill="none"
      width={path.w}
      height={path.h}
      viewBox={`0 0 ${path.w} ${path.h}`}
      className="pointer-events-none absolute inset-0 -z-0"
    >
      <path d={path.d} style={{ stroke: color }} strokeWidth={2} strokeOpacity={reduce ? 0.6 : 0.25} strokeLinecap="round" />
      {!reduce && (
        <path d={path.d} stroke={`url(#${id})`} strokeWidth={2} strokeLinecap="round" />
      )}
      <defs>
        <motion.linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={start}
          animate={play ? end : start}
          transition={{ delay, duration, ease: [0.16, 1, 0.3, 1] }}
        >
          <stop style={{ stopColor: color, stopOpacity: 0 }} />
          <stop offset="50%" style={{ stopColor: color, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}
