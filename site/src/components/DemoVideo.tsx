"use client";
import { PlayIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { DEMO_POSTER, DEMO_VIDEO_EMBED_URL } from "@/lib/links";

/**
 * The inline demo video, streamed from YouTube. A poster facade until clicked: the iframe (and everything it pulls
 * in) only mounts once someone presses play, so the YouTube player never loads on page load.
 */
export function DemoVideo({ className = "" }: { className?: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`${DEMO_VIDEO_EMBED_URL}?autoplay=1&rel=0`}
        title="Tally demo video"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className={`aspect-[1728/1080] w-full rounded-3xl bg-black shadow-card ring-1 ring-line ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label="Play the Tally demo video"
      className={`group relative aspect-[1728/1080] w-full overflow-hidden rounded-3xl bg-black shadow-card ring-1 ring-line ${className}`}
    >
      <Image src={DEMO_POSTER} alt="" fill sizes="(min-width: 1024px) 64rem, 100vw" className="object-cover" priority={false} />
      <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors duration-150 group-hover:bg-black/35">
        <span className="grid size-16 place-items-center rounded-full bg-white/90 text-night shadow-lg transition-transform duration-150 group-hover:scale-105">
          <PlayIcon aria-hidden weight="fill" className="size-6 translate-x-0.5" />
        </span>
      </span>
    </button>
  );
}
