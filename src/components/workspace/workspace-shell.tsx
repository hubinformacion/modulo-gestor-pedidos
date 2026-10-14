"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight, ClipboardList, ChartNoAxesCombined, Package, Tags, TicketPercent, Settings2, ReceiptText, PanelLeftClose, PanelLeftOpen, Menu, X, BookOpen, LayoutDashboard } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

const managerItems = [
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, group: "Operación" },
  { href: "/admin/dashboard", label: "Dashboard", icon: ChartNoAxesCombined, group: "Operación" },
  { href: "/admin/inventario", label: "Inventario", icon: Package, group: "Catálogo" },
  { href: "/admin/promociones", label: "Promociones", icon: Tags, group: "Catálogo" },
  { href: "/admin/cupones", label: "Cupones", icon: TicketPercent, group: "Catálogo" },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings2, group: "Sistema" },
  { href: "/admin/guia", label: "Guía de uso", icon: BookOpen, group: "Ayuda" },
];
const treasuryItems = [
  { href: "/tesoreria-recaudacion/resumen", label: "Resumen", icon: LayoutDashboard, group: "Operación" },
  { href: "/tesoreria-recaudacion", label: "Solicitudes", icon: ReceiptText, group: "Operación" },
  { href: "/tesoreria-recaudacion/guia", label: "Guía de uso", icon: BookOpen, group: "Ayuda" },
];
const preferenceKey = "fec:sidebar:v1";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("fec:sidebar-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("fec:sidebar-change", callback); };
}
function readCollapsed() { try { return localStorage.getItem(preferenceKey) === "collapsed"; } catch { return false; } }
const serverCollapsed = () => false;

type Profile = { name: string; email: string; image: string | null; units: string[]; service: boolean };
function Avatar({ profile }: { profile: Profile }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const image = profile.image?.startsWith("https://") ? profile.image : null;
  const initials = (profile.name.trim() || profile.email).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="workspace-avatar" aria-hidden="true">{image && failedSource !== image ? (
    // Google owns these URLs; use the original image without an optimization proxy or remote URL wildcard.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" referrerPolicy="no-referrer" width={40} height={40} onError={() => setFailedSource(image)} />
  ) : initials}</span>;
}
export function WorkspaceShell({ kind, profile, children }: { kind: "manager" | "treasury"; profile: Profile; children: ReactNode }) {
  const pathname = usePathname();
  const savedCollapsed = useSyncExternalStore(subscribe, readCollapsed, serverCollapsed);
  const [temporaryCollapsed, setTemporaryCollapsed] = useState<boolean | null>(null);
  const collapsed = temporaryCollapsed ?? savedCollapsed;
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = kind === "manager" ? managerItems : treasuryItems;
  const title = kind === "manager" ? "Gestión editorial" : "Tesorería Recaudación";
  const current = [...items].sort((a, b) => b.href.length - a.href.length).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? items[0];
  const detail = pathname.startsWith(`${current.href}/`);
  function toggleCollapsed() {
    try { localStorage.setItem(preferenceKey, collapsed ? "expanded" : "collapsed"); window.dispatchEvent(new Event("fec:sidebar-change")); } catch { setTemporaryCollapsed(!collapsed); }
  }
  function sidebar(mobile = false) {
    const compact = collapsed && !mobile;
    return <div className={cn("workspace-sidebar-inner", compact && "is-compact")}>
      <div className="workspace-identity"><span className="workspace-mark" aria-hidden="true">{kind === "manager" ? <ClipboardList /> : <ReceiptText />}</span><div className="workspace-expanded"><span className="workspace-overline">Espacio de trabajo</span><p>{title}</p></div></div>
      <nav aria-label={title} className="workspace-nav">{items.map(({ href, label, icon: Icon, group }, index) => {
        const active = current.href === href;
        return <div key={href}>{index === 0 || items[index - 1].group !== group ? <p className="workspace-nav-group"><span className="workspace-expanded">{group}</span></p> : null}<Link href={href} prefetch={false} title={compact ? label : undefined} aria-label={compact ? label : undefined} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} className={cn("workspace-nav-link", active && "is-active")}><Icon className="size-[18px] shrink-0" aria-hidden="true" /><span className="workspace-expanded">{label}</span>{active ? <span className="workspace-active-dot workspace-expanded" aria-hidden="true" /> : null}</Link></div>;
      })}</nav>
      <div className="workspace-account"><div className="workspace-profile" title={compact ? `${profile.name || profile.email} · ${profile.email}` : undefined}><Avatar profile={profile} /><div className="workspace-expanded min-w-0"><p className="workspace-profile-name">{profile.name.trim() || profile.email}</p><p className="workspace-profile-email" title={profile.email}>{profile.email}</p></div></div><div className="workspace-expanded">{kind === "treasury" ? <div className="workspace-unit-list">{profile.units.map((unit) => <span key={unit} data-unit={unit === "Instituto" ? "instituto" : "universidad"}>{unit}</span>)}{profile.service ? <p>Buzón de servicio · Solo consulta</p> : null}</div> : <p className="workspace-account-role">Gestor de Fondo Editorial</p>}</div><LogoutButton compact={compact} />{compact ? <button type="button" onClick={toggleCollapsed} className="workspace-account-hint w-full" aria-label={`Ver cuenta de ${profile.name || profile.email}`}>Cuenta</button> : null}</div>
    </div>;
  }
  return <div className="workspace" data-collapsed={collapsed} data-workspace={kind}>
    <aside className="workspace-sidebar" aria-label="Menú principal">{sidebar()}</aside>
    <div className="workspace-body">
      <header className="workspace-topbar">
        <button type="button" className="workspace-icon-button workspace-desktop-toggle" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir navegación" : "Plegar navegación"} aria-expanded={!collapsed}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button>
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Trigger className="workspace-icon-button workspace-mobile-toggle" aria-label="Abrir navegación"><Menu /></Dialog.Trigger>
          <Dialog.Portal><Dialog.Backdrop className="workspace-menu-backdrop" /><Dialog.Popup className="workspace-mobile-menu"><Dialog.Title className="sr-only">{title}</Dialog.Title><Dialog.Description className="sr-only">Navegación y cuenta del espacio de trabajo.</Dialog.Description><Dialog.Close className="workspace-icon-button workspace-menu-close" aria-label="Cerrar navegación"><X /></Dialog.Close>{sidebar(true)}</Dialog.Popup></Dialog.Portal>
        </Dialog.Root>
        <nav aria-label="Ruta actual" className="workspace-breadcrumb"><span className="workspace-breadcrumb-root">{kind === "manager" ? "Administración" : "Tesorería Recaudación"}</span><ChevronRight aria-hidden="true" /><Link href={current.href} aria-current={!detail ? "page" : undefined}>{current.label}</Link>{detail ? <><ChevronRight aria-hidden="true" /><span aria-current="page">Detalle</span></> : null}</nav>
        <span className="workspace-topbar-label">{profile.service ? "Solo consulta" : kind === "manager" ? "Gestión de pedidos" : "Emisión de comprobantes"}</span>
      </header>
      <main id="contenido" tabIndex={-1} className="workspace-content enter-page">{children}</main>
    </div>
  </div>;
}
