"use client";

import type { ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";

export function DeliveryWorkspaces({ groups }: {
  groups: { id: string; label: string; summary: string; content: ReactNode }[];
}) {
  return (
    <Tabs.Root defaultValue={groups[0].id} className="min-w-0">
      <Tabs.List aria-label="Configuración de entregas" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/60 p-1.5 @min-[36rem]:gap-2">
        {groups.map(({ id, label, summary }) => (
          <Tabs.Tab key={id} value={id} className="flex min-h-12 min-w-0 flex-col items-start justify-center rounded-lg border border-transparent px-2 py-2 text-left text-xs font-medium leading-4 transition-colors hover:bg-white/70 aria-selected:border-border aria-selected:bg-white aria-selected:text-primary @min-[36rem]:px-4 @min-[36rem]:py-3 @min-[36rem]:text-sm">
            {label}
            <span className="mt-1 hidden text-xs leading-5 font-normal text-muted-foreground @min-[36rem]:block">{summary}</span>
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {groups.map(({ id, content }) => (
        <Tabs.Panel key={id} value={id} keepMounted className="step-panel mt-5 min-w-0 rounded-lg outline-offset-4 data-[hidden]:hidden @min-[36rem]:mt-6">
          {content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
