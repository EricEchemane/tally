import { ChatCircleTextIcon, ListMagnifyingGlassIcon, WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";
import { Label, SectionShell } from "@/components/marketing";
import { AssistantChat } from "./AssistantChat";

const POINTS = [
  { Icon: ChatCircleTextIcon, title: "Just ask", body: "Type a question the way you'd ask a colleague. No reports to build." },
  { Icon: ListMagnifyingGlassIcon, title: "Answers from your records", body: "Never a guess. Every answer shows how it was worked out." },
  { Icon: WifiSlashIcon, title: "Private and offline", body: "It runs on your laptop. Your questions never leave it." },
];

export function Assistant() {
  return (
    <SectionShell tone="panel" id="assistant" labelledBy="assistant-title">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <div>
          <Label>Assistant</Label>
          <h2 id="assistant-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
            Don&apos;t dig through files. Ask.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Tally reads your receipts, and it also talks with you. Ask about your Liquidations in plain words and get
            an answer in seconds.
          </p>
          <ul className="mt-9 grid gap-6">
            {POINTS.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <AssistantChat />
      </div>
    </SectionShell>
  );
}
