/** A page or section whose content lands in a later ticket. Remove once the content is in. */
export function Placeholder({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-2xl text-muted">{children}</p>
      <p className="mt-4 inline-block rounded-md bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn">Coming soon</p>
    </section>
  );
}
