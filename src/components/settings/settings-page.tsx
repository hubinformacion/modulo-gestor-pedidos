import type { ReactNode } from "react";

export function SettingsPage({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="@container min-w-0 space-y-7">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  );
}

export function SettingsSection({ id, title, description, children }: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="scroll-mt-20 text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1.5 max-w-[65ch] text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}
