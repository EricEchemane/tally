"use client";
import { CloudSlashIcon, DeviceMobileIcon, LaptopIcon, WifiHighIcon } from "@phosphor-icons/react";
import { useRef, type ReactNode, type Ref } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";

function Node({ icon, label, nodeRef }: { icon: ReactNode; label: string; nodeRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-4 text-center">
      <div
        ref={nodeRef}
        className="grid size-16 place-items-center rounded-full bg-surface text-accent shadow-card ring-2 ring-accent/20 sm:size-20"
      >
        {icon}
      </div>
      <span className="text-[0.9375rem] font-semibold whitespace-nowrap">{label}</span>
    </div>
  );
}

/** Phone to office Wi-Fi to laptop, with the cloud left out. The beam runs once to show the route photos take. */
export function DataPath() {
  const container = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const wifi = useRef<HTMLDivElement>(null);
  const laptop = useRef<HTMLDivElement>(null);
  const icon = "size-8 sm:size-9";

  return (
    <figure className="flex flex-col justify-center">
      <div className="mx-auto mb-12 flex w-fit items-center gap-2.5 rounded-full bg-surface px-4 py-2 text-muted ring-1 ring-line">
        <CloudSlashIcon aria-hidden className="size-5" />
        <span className="text-sm">The cloud is never part of the route.</span>
      </div>
      <div ref={container} className="relative grid grid-cols-3 items-start gap-x-6">
        <Node nodeRef={phone} label="Your phone" icon={<DeviceMobileIcon aria-hidden weight="bold" className={icon} />} />
        <Node nodeRef={wifi} label="Office Wi-Fi" icon={<WifiHighIcon aria-hidden weight="bold" className={icon} />} />
        <Node nodeRef={laptop} label="Your laptop" icon={<LaptopIcon aria-hidden weight="bold" className={icon} />} />
        <AnimatedBeam containerRef={container} fromRef={phone} toRef={wifi} color="var(--accent)" />
        <AnimatedBeam containerRef={container} fromRef={wifi} toRef={laptop} delay={0.9} color="var(--accent)" />
      </div>
      <figcaption className="sr-only">
        Receipt photos go from your phone over your office Wi-Fi to your laptop, and never to the cloud.
      </figcaption>
    </figure>
  );
}
