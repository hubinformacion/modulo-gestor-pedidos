"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, UsersRound, Package, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/pedidos", label: "Pedidos", Icon: ClipboardList },
  { href: "/admin/inventario", label: "Inventario", Icon: Package },
  { href: "/admin", label: "Configuración", Icon: UsersRound },
  { href: "/admin/vista-previa", label: "Vista previa del pedido", Icon: BookOpen },
];

export function AdminNav() {
  const pathname = usePathname();
  return <nav aria-label="Administración" className="mx-auto flex max-w-6xl flex-wrap gap-x-5 px-6 sm:px-10">
    {items.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={(pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`))) ? "page" : undefined} className={cn("-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-1 text-xs font-medium sm:text-sm", (pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`))) ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}><Icon className="size-4" aria-hidden="true" />{label}</Link>)}
  </nav>;
}
