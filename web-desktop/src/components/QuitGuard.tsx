"use client";
// The Mac app holds a quit while receipts or questions are still waiting for the AI and asks here.
// Nothing is lost either way: unfinished work resumes the next time Tally opens.
import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./ui";

export function QuitGuard() {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const onAsk = (e: Event) => setPending((e as CustomEvent<{ pending: number }>).detail.pending);
    window.addEventListener("tally:confirm-quit", onAsk);
    return () => window.removeEventListener("tally:confirm-quit", onAsk);
  }, []);
  return (
    <Dialog open={pending > 0} onClose={() => setPending(0)} title="Tally is still working"
      description={<>
        {pending} {pending === 1 ? "item is" : "items are"} still waiting for the AI (receipts being read or questions being answered).
        If you quit now, {pending === 1 ? "it continues" : "they continue"} the next time you open Tally. Nothing is lost.
      </>}
      footer={<>
        <Button variant="ghost" onClick={() => { window.location.href = "/__tally/quit"; }}>Quit anyway</Button>
        <Button variant="primary" onClick={() => setPending(0)} data-autofocus>Keep open</Button>
      </>} />
  );
}
