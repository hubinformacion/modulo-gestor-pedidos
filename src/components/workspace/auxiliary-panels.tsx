"use client";

import { Dialog } from "@base-ui/react/dialog";
import { History, MessageSquareText, X } from "lucide-react";
import type { ReactNode } from "react";

export function AuxiliaryPanels({ notes, history, notesCount, historyCount }: {
  notes: ReactNode;
  history: ReactNode;
  notesCount: number;
  historyCount: number;
}) {
  const panels = [
    { title: "Notas internas", count: notesCount, content: notes, Icon: MessageSquareText, description: "Comentarios privados del equipo de Fondo Editorial." },
    { title: "Historial de atención", count: historyCount, content: history, Icon: History, description: "Registro de cambios y responsables del pedido." },
  ];

  return <>{panels.map(({ title, count, content, Icon, description }) => (
    <Dialog.Root key={title}>
      <Dialog.Trigger className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-medium transition-colors hover:bg-secondary">
        <Icon className="size-3.5" aria-hidden="true" />{title}
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-primary">{count}</span>
      </Dialog.Trigger>
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="workspace-dialog-backdrop fixed inset-0 z-40 bg-black/30" />
        <Dialog.Popup className="workspace-dialog-popup fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-xl sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-xs leading-6 text-muted-foreground">{description}</Dialog.Description>
            </div>
            <Dialog.Close className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-secondary" aria-label={`Cerrar ${title.toLowerCase()}`}>
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="mt-5">{content}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ))}</>;
}
