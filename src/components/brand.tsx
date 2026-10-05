import { BookOpen } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center border border-primary/30" aria-hidden="true">
        <BookOpen className="size-5" strokeWidth={1.5} />
      </span>
      <div>
        <p className="text-sm font-semibold tracking-tight">Fondo Editorial</p>
        <p className={compact ? "text-xs text-muted-foreground" : "eyebrow mt-1 text-muted-foreground"}>Continental</p>
      </div>
    </div>
  );
}
