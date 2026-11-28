"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { BookOpen, ChartNoAxesCombined, ChevronDown, ChevronRight, ClipboardList, Landmark, LayoutGrid, Mail, Menu, Package, PanelLeftClose, PanelLeftOpen, Plug, Settings2, ShieldCheck, Tags, TicketPercent, Truck, UsersRound, X, type LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/access/logout-button";
import { cn } from "@/shared/utils/cn";

type GroupId = (typeof groups)[number]["id"];

type NavigationItem = { href: string; label: string; icon: LucideIcon };
const settingsRoot = "/admin/configuracion";
const settings = [
  { href: `${settingsRoot}/accesos`, label: "Accesos", icon: UsersRound },
  { href: `${settingsRoot}/seguridad`, label: "Seguridad", icon: ShieldCheck },
  { href: `${settingsRoot}/pagos`, label: "Pagos", icon: Landmark },
  { href: `${settingsRoot}/entregas`, label: "Entregas", icon: Truck },
  { href: `${settingsRoot}/correos`, label: "Correos", icon: Mail },
  { href: `${settingsRoot}/integraciones`, label: "Integraciones", icon: Plug },
];

const groups = [
  {
    id: "operacion", label: "Operación", icon: ClipboardList,
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
      { href: "/admin/reporte", label: "Reporte", icon: ChartNoAxesCombined },
    ],
  },
  {
    id: "catalogo", label: "Catálogo", icon: Package,
    items: [
      { href: "/admin/inventario", label: "Inventario", icon: Package },
      { href: "/admin/promociones", label: "Promociones", icon: Tags },
      { href: "/admin/cupones", label: "Cupones", icon: TicketPercent },
    ],
  },
  { id: "configuracion", label: "Configuración", icon: Settings2, items: settings },
] as const;
const utilityLinks = [
  { href: "/admin/guia", label: "Guía de uso", icon: BookOpen },
];
const items = [...groups.flatMap((group) => group.items), ...utilityLinks];
const title = "Fondo Editorial";
const preferenceKey = "fec:sidebar:v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("fec:sidebar-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("fec:sidebar-change", callback);
  };
}
function readCollapsed() {
  try { return localStorage.getItem(preferenceKey) === "collapsed"; }
  catch { return false; }
}
const serverCollapsed = () => false;

type Profile = { name: string; email: string; image: string | null; master: boolean };
function Avatar({ profile }: { profile: Profile }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const image = profile.image?.startsWith("https://") ? profile.image : null;
  const initials = (profile.name.trim() || profile.email).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="workspace-avatar" aria-hidden="true">{image && failedSource !== image ? (
    // eslint-disable-next-line @next/next/no-img-element -- Preserve Google's private image URL and referrer policy.
    <img src={image} alt="" referrerPolicy="no-referrer" width={32} height={32} onError={() => setFailedSource(image)} />
  ) : initials}</span>;
}

function NavigationLink({ item, current, compact, onNavigate }: {
  item: NavigationItem;
  current: string;
  compact?: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      title={compact ? item.label : undefined}
      aria-label={compact ? item.label : undefined}
      aria-current={item.href === current ? "page" : undefined}
      onClick={onNavigate}
      className="workspace-nav-link"
    >
      <Icon aria-hidden="true" />
      <span className="workspace-expanded">{item.label}</span>
    </Link>
  );
}

export function WorkspaceShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const pathname = usePathname();
  const savedCollapsed = useSyncExternalStore(subscribe, readCollapsed, serverCollapsed);
  const [temporaryCollapsed, setTemporaryCollapsed] = useState<boolean | null>(null);
  const collapsed = temporaryCollapsed ?? savedCollapsed;
  const [mobileOpen, setMobileOpen] = useState(false);
  const inSettings = pathname === settingsRoot || pathname.startsWith(`${settingsRoot}/`);
  const current = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? (inSettings ? settings[0] : items[0]);
  const detail = pathname.startsWith(`${current.href}/`);
  const activeGroup = groups.find((group) => group.items.some((item) => item.href === current.href))?.id;
  const [menu, setMenu] = useState<{ activeGroup?: GroupId; open: GroupId[] }>({ activeGroup, open: activeGroup ? [activeGroup] : [] });
  if (menu.activeGroup !== activeGroup) {
    setMenu({ activeGroup, open: activeGroup && !menu.open.includes(activeGroup) ? [...menu.open, activeGroup] : menu.open });
  }
  const closeMobile = () => setMobileOpen(false);

  function setRailCollapsed(next: boolean) {
    try {
      localStorage.setItem(preferenceKey, next ? "collapsed" : "expanded");
      setTemporaryCollapsed(null);
      window.dispatchEvent(new Event("fec:sidebar-change"));
    } catch {
      setTemporaryCollapsed(next);
    }
  }

  function toggleGroup(id: GroupId, compact: boolean) {
    setMenu((current) => ({
      ...current,
      open: current.open.includes(id)
        ? compact ? current.open : current.open.filter((item) => item !== id)
        : [...current.open, id],
    }));
    if (compact) setRailCollapsed(false);
  }

  function sidebar(mobile = false) {
    const compact = collapsed && !mobile;
    return (
      <div className={cn("workspace-sidebar-inner", compact && "is-compact")}>
        <Link href="/admin/pedidos" prefetch={false} onClick={closeMobile} className="workspace-identity" aria-label={title}>
          <span className="workspace-mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- Reuse the application favicon as the workspace mark. */}
            <img src="/isotipo.svg" width={28} height={28} alt="" />
          </span>
          <span className="workspace-expanded">{title}</span>
        </Link>
        <nav aria-label="Menú principal" className="workspace-nav">
          <ul className="workspace-nav-groups">
            {groups.map(({ id, label, icon: Icon, items: children }) => {
              const active = id === activeGroup;
              const open = !compact && menu.open.includes(id);
              const panel = `workspace-${mobile ? "movil" : "escritorio"}-${id}`;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="workspace-nav-link workspace-nav-menu"
                    data-current={active}
                    title={compact ? label : undefined}
                    aria-label={compact ? label : undefined}
                    aria-controls={panel}
                    aria-expanded={open}
                    onClick={() => toggleGroup(id, compact)}
                  >
                    <Icon aria-hidden="true" />
                    <span className="workspace-expanded">{label}</span>
                    <ChevronDown aria-hidden="true" className="workspace-expanded workspace-menu-chevron" />
                  </button>
                  <div id={panel} className="workspace-submenu-region" data-open={open} inert={!open}>
                    <div className="workspace-submenu-clip">
                      <ul className="workspace-submenu">
                        {children.map((item) => <li key={item.href}><NavigationLink item={item} current={current.href} onNavigate={closeMobile} /></li>)}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <ul className="workspace-nav-utilities">
            {utilityLinks.map((item) => <li key={item.href}><NavigationLink item={item} current={current.href} compact={compact} onNavigate={closeMobile} /></li>)}
          </ul>
        </nav>
        <div className="workspace-account">
          <div className="workspace-profile" title={compact ? profile.email : undefined}>
            <Avatar profile={profile} />
            <div className="workspace-expanded min-w-0">
              <p className="workspace-profile-name">{profile.name.trim() || profile.email}</p>
              <p className="workspace-profile-email" title={profile.email}>{profile.email}</p>
              {profile.master ? <p className="workspace-account-role">Cuenta maestra · Solo consulta de pedidos</p> : null}
            </div>
          </div>
          <LogoutButton compact={compact} />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace" data-collapsed={collapsed}>
      <aside className="workspace-sidebar" aria-label="Navegación de Fondo Editorial">{sidebar()}</aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <button
            type="button"
            className="workspace-icon-button workspace-desktop-toggle"
            onClick={() => setRailCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir navegación" : "Plegar navegación"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger className="workspace-icon-button workspace-mobile-toggle" aria-label="Abrir navegación"><Menu /></Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="workspace-menu-backdrop" />
              <Dialog.Popup className="workspace-mobile-menu">
                <Dialog.Title className="sr-only">{title}</Dialog.Title>
                <Dialog.Description className="sr-only">Navegación y cuenta del espacio de trabajo.</Dialog.Description>
                <Dialog.Close className="workspace-icon-button workspace-menu-close" aria-label="Cerrar navegación"><X /></Dialog.Close>
                {sidebar(true)}
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <nav aria-label="Ruta actual" className="workspace-breadcrumb">
            <span className="workspace-breadcrumb-root"><LayoutGrid aria-hidden="true" />Administración</span>
            <ChevronRight aria-hidden="true" />
            {inSettings ? <><span>Configuración</span><ChevronRight aria-hidden="true" /></> : null}
            {detail ? <Link href={current.href}>{current.label}</Link> : <span aria-current="page">{current.label}</span>}
            {detail ? <><ChevronRight aria-hidden="true" /><span aria-current="page">Detalle</span></> : null}
          </nav>
        </header>
        <main id="contenido" tabIndex={-1} className="workspace-content">
          <div key={pathname} className="enter-page">{children}</div>
        </main>
      </div>
    </div>
  );
}
