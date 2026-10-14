import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function DetailCardHeading({ icon: Icon, title, description, aside, level = 2 }: {
  icon: LucideIcon;
  title: string;
  description?: string;
  aside?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return <div className="detail-card-heading">
    <span className="detail-card-icon"><Icon aria-hidden="true" /></span>
    <div className="min-w-0"><Heading>{title}</Heading>{description ? <p>{description}</p> : null}</div>
    {aside ? <div className="ml-auto">{aside}</div> : null}
  </div>;
}
