import type { ReactNode } from "react";

export function WorkspacePageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="workspace-page-heading"><div className="min-w-0"><p className="workspace-page-eyebrow">{eyebrow}</p><h1 className="page-heading">{title}</h1><p className="workspace-page-description">{description}</p></div>{actions ? <div className="workspace-page-actions">{actions}</div> : null}</header>;
}
