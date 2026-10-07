import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function DetailButton({ href, context }: { href: string; context: string }) {
  return <Link href={href} className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-primary/15 bg-secondary px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Ver detalles<ArrowUpRight className="size-3" aria-hidden="true" /><span className="sr-only"> · {context}</span></Link>;
}
