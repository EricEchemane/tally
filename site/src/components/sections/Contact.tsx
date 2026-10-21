"use client";
import {
  ArrowCounterClockwiseIcon,
  ChatsCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  EnvelopeSimpleIcon,
  LockSimpleIcon,
  PaperPlaneTiltIcon,
  TrayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { sendContact, startContact, type ContactState } from "@/app/actions/contact";
import { Label, SectionShell } from "@/components/marketing";
import { isTopic, LIMITS, readFields, TOPICS, validateContact, type FieldName } from "@/lib/contact/validate";

const NEXT_STEPS = [
  { Icon: EnvelopeSimpleIcon, title: "A confirmation, right away", body: "Sent to the address you give, so you know it arrived." },
  { Icon: ChatsCircleIcon, title: "Read by the people who built Tally", body: "No ticket queue and no bots." },
  { Icon: TrayIcon, title: "A reply by email", body: "To the same address. It isn't added to any mailing list." },
];

export function Contact() {
  // Bumping the key gives a fresh form (and a fresh token) after a message is sent.
  const [round, setRound] = useState(0);

  return (
    <SectionShell tone="panel" id="contact" labelledBy="contact-title">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <Label>Contact</Label>
          <h2 id="contact-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
            Talk to us.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            A question about Tally, a pilot for your team, or a receipt it read wrong. Write to us here.
          </p>
          <ol className="mt-10 space-y-6">
            {NEXT_STEPS.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint-strong text-accent ring-1 ring-line-strong">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line sm:p-9">
          <ContactForm key={round} onReset={() => setRound((r) => r + 1)} />
        </div>
      </div>
    </SectionShell>
  );
}

const input =
  "block w-full rounded-2xl bg-sunken px-4 py-3.5 text-base text-ink ring-1 ring-line-strong outline-none " +
  "transition-[box-shadow,background-color] duration-150 ease-out placeholder:text-faint " +
  "hover:ring-faint focus:bg-paper focus:ring-2 focus:ring-lime aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-bad";

async function submit(_: ContactState, form: FormData): Promise<ContactState> {
  // The same rules run on the server; checking here first gives instant, field-by-field feedback.
  const v = validateContact(readFields(form));
  if (!v.ok) return { status: "error", errors: v.errors, fields: v.fields };
  // The server needs nothing from the previous answer, so none of it is sent back.
  return sendContact({ status: "idle" }, form);
}

function ContactForm({ onReset }: { onReset: () => void }) {
  const [state, action, pending] = useActionState(submit, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const token = useRef("");
  const [length, setLength] = useState(0);
  // Fields the visitor has edited since the last answer: their old error is hidden while they fix it.
  const [edited, setEdited] = useState<{ after: ContactState; names: FieldName[] }>({ after: state, names: [] });
  const fixed = edited.after === state ? edited.names : [];
  const errorOf = (name: FieldName) => (fixed.includes(name) ? undefined : state.errors?.[name]);

  useEffect(() => {
    startContact()
      .then((t) => (token.current = t))
      .catch(() => {});
  }, []);

  // After an answer with errors, move focus to the first field that needs attention.
  useEffect(() => {
    if (state.errors) formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [state]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Submitting by hand (not via the form's action prop) keeps what was typed: React would otherwise reset the
    // form after every attempt, including failed ones.
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("token", token.current);
    startTransition(() => action(data));
  }

  function touched(name: FieldName) {
    if (!fixed.includes(name)) setEdited({ after: state, names: [...fixed, name] });
  }

  const id = useId();
  const ids = { topic: `${id}-topic`, name: `${id}-name`, email: `${id}-email`, message: `${id}-message`, count: `${id}-count` };

  if (state.status === "sent") return <Sent to={state.confirmationTo} onReset={onReset} />;

  const topic = state.fields?.topic && isTopic(state.fields.topic) ? state.fields.topic : "question";
  const over = length > LIMITS.message;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={pending} className="grid gap-6">
      <fieldset aria-describedby={errorOf("topic") ? ids.topic : undefined}>
        <legend className="mb-3 text-sm font-semibold">What’s it about?</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TOPICS).map(([value, label]) => (
            <label
              key={value}
              className="cursor-pointer rounded-full bg-sunken px-4 py-2.5 text-sm font-medium text-muted ring-1 ring-line-strong transition-[background-color,color,box-shadow] duration-150 ease-out select-none hover:text-ink has-checked:bg-lime has-checked:text-lime-ink has-checked:ring-lime has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input type="radio" name="topic" value={value} defaultChecked={value === topic} onChange={() => touched("topic")} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        <FieldError id={ids.topic} error={errorOf("topic")} />
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Your name" htmlFor={`${ids.name}-input`} error={errorOf("name")} errorId={ids.name}>
          <input
            id={`${ids.name}-input`}
            name="name"
            autoComplete="name"
            maxLength={LIMITS.name}
            defaultValue={state.fields?.name}
            placeholder="Maria Santos"
            aria-invalid={!!errorOf("name")}
            aria-describedby={errorOf("name") ? ids.name : undefined}
            onChange={() => touched("name")}
            className={input}
          />
        </Field>
        <Field label="Work email" htmlFor={`${ids.email}-input`} error={errorOf("email")} errorId={ids.email}>
          <input
            id={`${ids.email}-input`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={LIMITS.email}
            defaultValue={state.fields?.email}
            placeholder="maria@company.ph"
            aria-invalid={!!errorOf("email")}
            aria-describedby={errorOf("email") ? ids.email : undefined}
            onChange={() => touched("email")}
            className={input}
          />
        </Field>
      </div>

      <Field label="Message" htmlFor={`${ids.message}-input`} error={errorOf("message")} errorId={ids.message}
        aside={
          <span id={ids.count} aria-live="polite" className={`num text-xs ${over ? "text-bad" : "text-faint"}`}>
            {length.toLocaleString("en-US")} / {LIMITS.message.toLocaleString("en-US")}
          </span>
        }
      >
        <textarea
          id={`${ids.message}-input`}
          name="message"
          rows={6}
          defaultValue={state.fields?.message}
          placeholder="Tell us what you need, and anything about your setup that helps."
          aria-invalid={!!errorOf("message")}
          aria-describedby={[errorOf("message") && ids.message, ids.count].filter(Boolean).join(" ")}
          onChange={(e) => {
            setLength(e.currentTarget.value.length);
            touched("message");
          }}
          className={`${input} min-h-40 resize-y leading-relaxed`}
        />
      </Field>

      {/* Honeypot: hidden from people and assistive tech; anything typed here marks the sender as a bot. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Reference code
          <input name="ref_code" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="enter flex items-start gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm leading-relaxed text-bad">
          <WarningCircleIcon aria-hidden weight="bold" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-faint">
          <LockSimpleIcon aria-hidden className="size-4 shrink-0" />
          We only use your email to reply to you.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-lime px-6 text-[0.9375rem] font-semibold whitespace-nowrap text-lime-ink transition-[background-color,transform,opacity] duration-150 ease-out hover:bg-lime-hover active:scale-[0.98] disabled:cursor-progress disabled:opacity-70"
        >
          {pending ? (
            <CircleNotchIcon aria-hidden weight="bold" className="size-[1.1em] animate-spin motion-reduce:animate-none" />
          ) : (
            <PaperPlaneTiltIcon aria-hidden weight="bold" className="size-[1.1em]" />
          )}
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  errorId,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      {children}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="enter mt-2 flex items-center gap-1.5 text-sm text-bad">
      <WarningCircleIcon aria-hidden weight="bold" className="size-4 shrink-0" />
      {error}
    </p>
  );
}

function Sent({ to, onReset }: { to?: string; onReset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus the result so screen readers announce it and keyboard users aren't left on a button that's gone.
  useEffect(() => heading.current?.focus(), []);

  return (
    <div role="status" className="enter flex min-h-[28rem] flex-col items-center justify-center py-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-lime text-lime-ink shadow-[0_0_0_10px_rgb(197_240_106/0.12)]">
        <CheckIcon aria-hidden weight="bold" className="size-8" />
      </span>
      <h3 ref={heading} tabIndex={-1} className="mt-8 text-2xl font-semibold tracking-[-0.02em] outline-none">
        Message sent.
      </h3>
      <p className="mt-3 max-w-sm leading-relaxed text-muted">
        {to ? (
          <>
            We emailed a confirmation to <span className="font-medium break-all text-ink">{to}</span>. If it isn’t there in a
            few minutes, check your spam folder.
          </>
        ) : (
          "Thanks for writing. We'll reply by email."
        )}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-ink ring-1 ring-line-strong transition-colors duration-150 hover:bg-sunken"
      >
        <ArrowCounterClockwiseIcon aria-hidden weight="bold" className="size-4" />
        Send another message
      </button>
    </div>
  );
}
