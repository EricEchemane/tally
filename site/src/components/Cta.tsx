import { AppleLogoIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr";
import { DEMO_HREF, DOWNLOAD_HREF, DOWNLOAD_LABEL } from "@/lib/links";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98]";

const TONES = {
  lime: "bg-lime text-lime-ink hover:bg-lime-hover",
  night: "bg-night text-white hover:bg-night-2",
};

/** The page's one action: get the Mac app. Same label everywhere it appears. */
export function DownloadButton({
  className = "",
  compact = false,
  tone = "lime",
}: {
  className?: string;
  compact?: boolean;
  tone?: keyof typeof TONES;
}) {
  return (
    <a
      href={DOWNLOAD_HREF}
      className={`${base} ${TONES[tone]} ${compact ? "h-10 px-4 text-sm" : "h-12 px-6 text-[0.9375rem]"} ${className}`}
    >
      <AppleLogoIcon aria-hidden weight="fill" className="size-[1.1em] -translate-y-px" />
      {DOWNLOAD_LABEL}
    </a>
  );
}

/** Secondary action: the dark pill beside the download button, as in the reference hero. */
export function DemoButton({ className = "" }: { className?: string }) {
  return (
    <a href={DEMO_HREF} className={`${base} ${TONES.night} h-12 px-6 text-[0.9375rem] ${className}`}>
      <PlayIcon aria-hidden weight="fill" className="size-4" />
      Watch the demo
    </a>
  );
}
