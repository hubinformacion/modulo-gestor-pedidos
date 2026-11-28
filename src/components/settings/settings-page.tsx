import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

export function SettingsPage({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="@container grid min-w-0 gap-5 sm:gap-6">
      <header className="border-b border-border pb-5">
        <h1 className="page-heading">{title}</h1>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  );
}

export function SettingsSection({ id, title, description, children, className }: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0 scroll-mt-20", className)}>
      <h2 id={id} className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1.5 max-w-[65ch] text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}
