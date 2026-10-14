"use client";
import type { CSSProperties, ReactNode } from "react";
import { Skeleton } from "boneyard-js/react";
import type { SkeletonResult } from "boneyard-js";

const patterns = {
  back: { height: 16, bones: [[0, 0, 600, 12, 3]] },
  fiveTabs: { height: 56, bones: [[12, 14, 155, 26, 5], [192, 14, 155, 26, 5], [372, 14, 135, 26, 5], [532, 14, 180, 26, 5], [742, 14, 140, 26, 5]] },
  inventoryTable: { height: 554, bones: [[0, 0, 1120, 48, 0, true], ...Array.from({ length: 9 }, (_, i) => [12 + i * 123, 18, 90, 11, 3]), ...Array.from({ length: 5 }, (_, i) => [[12, 85 + i * 100, 90, 12, 3], [135, 76 + i * 100, 180, 16, 4], [350, 85 + i * 100, 120, 13, 3], [505, 78 + i * 100, 100, 25, 6], [640, 85 + i * 100, 70, 13, 3], [745, 85 + i * 100, 70, 13, 3], [845, 85 + i * 100, 40, 13, 3], [910, 78 + i * 100, 70, 25, 6], [1005, 75 + i * 100, 95, 32, 7]]).flat()] },
  heading: { height: 96, bones: [[0, 0, 120, 10, 3], [0, 24, 280, 30, 5], [0, 73, 480, 12, 3]] },
  field: { height: 64, bones: [[0, 0, 170, 9, 3], [0, 21, 600, 43, 8]] },
  action: { height: 40, bones: [[0, 0, 600, 40, 8]] },
  tabs: { height: 56, bones: [[10, 12, 140, 30, 6], [220, 12, 140, 30, 6], [430, 12, 140, 30, 6]] },
  fourTabs: { height: 56, bones: [[8, 12, 110, 30, 6], [160, 12, 110, 30, 6], [312, 12, 110, 30, 6], [464, 12, 110, 30, 6]] },
  lines: { height: 150, bones: [[0, 0, 240, 15, 4], [0, 37, 530, 11, 3], [0, 70, 420, 11, 3], [0, 103, 480, 11, 3], [0, 136, 260, 11, 3]] },
  summary: { height: 245, bones: [[0, 0, 270, 16, 4], [0, 45, 380, 12, 3], [460, 45, 140, 12, 3], [0, 84, 360, 12, 3], [460, 84, 140, 12, 3], [0, 130, 290, 12, 3], [460, 130, 140, 12, 3], [0, 175, 240, 12, 3], [460, 175, 140, 12, 3], [0, 218, 160, 21, 4], [420, 218, 180, 21, 4]] },
  publication: { height: 125, bones: [[0, 0, 140, 21, 5], [0, 40, 430, 17, 4], [0, 72, 260, 10, 3], [0, 101, 130, 19, 4], [400, 93, 200, 32, 7]] },
  preview: { height: 290, bones: [[0, 0, 310, 18, 4], [0, 44, 600, 66, 8], [0, 132, 600, 150, 9, true], [130, 165, 340, 13, 3], [130, 199, 260, 10, 3], [130, 232, 310, 10, 3]] },
  requestsTable: { height: 378, bones: [[0, 0, 1120, 44, 0, true], ...Array.from({ length: 5 }, (_, i) => [[12, 75 + i * 64, 45, 12, 3], [95, 75 + i * 64, 95, 12, 3], [230, 70 + i * 64, 120, 14, 3], [385, 73 + i * 64, 110, 20, 6], [530, 70 + i * 64, 60, 20, 6], [630, 75 + i * 64, 80, 12, 3], [748, 69 + i * 64, 70, 24, 8], [850, 74 + i * 64, 100, 12, 3], [990, 64 + i * 64, 110, 35, 7]]).flat()] },
  table: { height: 388, bones: [
    [0, 0, 960, 48, 0, true], [18, 18, 95, 10, 3], [170, 18, 150, 10, 3], [440, 18, 95, 10, 3], [620, 18, 90, 10, 3],
    ...Array.from({ length: 5 }, (_, i) => [[18, 76 + i * 64, 96, 12, 3], [170, 71 + i * 64, 190, 13, 3], [170, 93 + i * 64, 145, 9, 3], [440, 71 + i * 64, 120, 26, 8], [620, 77 + i * 64, 90, 12, 3], [800, 65 + i * 64, 140, 36, 8]]).flat(),
  ] },
} as const;

function Bones({ kind }: { kind: keyof typeof patterns }) {
  const pattern = patterns[kind];
  const bones: SkeletonResult = { name: `loading-${kind}`, viewportWidth: kind === "table" ? 960 : kind === "inventoryTable" ? 1120 : kind === "requestsTable" ? 1120 : kind === "fiveTabs" ? 900 : 600, width: kind === "table" ? 960 : kind === "inventoryTable" ? 1120 : kind === "requestsTable" ? 1120 : kind === "fiveTabs" ? 900 : 600, height: pattern.height, bones: pattern.bones.map((bone) => [...bone]) as SkeletonResult["bones"] };
  return <div aria-hidden="true" data-loading-bones><Skeleton loading initialBones={bones} color="#e8e4ee" animate="pulse" fallback={<div className="rounded-lg bg-muted motion-safe:animate-pulse" style={{ height: pattern.height }} />}><div style={{ height: pattern.height }} /></Skeleton></div>;
}
function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div role="status" aria-busy="true" aria-label={label} className="min-w-0"><div aria-hidden="true">{children}</div><span className="sr-only">{label}…</span></div>;
}
function Card({ children, lilac = false }: { children: ReactNode; lilac?: boolean }) {
  return <div className={`min-w-0 rounded-xl border p-5 ${lilac ? "border-primary/15 bg-secondary/50" : "border-border bg-white"}`}>{children}</div>;
}
function Filters({ count = 3, boxed = false }: { count?: number; boxed?: boolean }) {
  return <div className={`mt-5 grid items-end gap-4 sm:grid-cols-2 ${count === 2 ? "xl:grid-cols-[minmax(0,1fr)_11rem_auto]" : count === 4 ? "xl:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto]" : "xl:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]"} ${boxed ? "workspace-filters" : ""}`}>{Array.from({ length: count }, (_, i) => <Bones key={i} kind="field" />)}<div className="w-28"><Bones kind="action" /></div></div>;
}
function Table({ inventory = false, compact = false }: { inventory?: boolean; compact?: boolean }) { return <div className="mt-5 overflow-x-auto rounded-xl border border-border"><div className={inventory ? "min-w-[1120px]" : compact ? "min-w-[1120px]" : "min-w-[850px]"}><Bones kind={inventory ? "inventoryTable" : compact ? "requestsTable" : "table"} /></div></div>; }
function SidePanel() { return <aside className="space-y-5"><Card><Bones kind="summary" /></Card><Card><Bones kind="lines" /></Card></aside>; }

function WorkspaceHeadingBones() {
  return <div className="flex flex-wrap justify-between gap-5"><div className="w-full max-w-xl"><Bones kind="heading" /></div><div className="w-28 pt-5"><Bones kind="action" /></div></div>;
}
export function OrdersSkeleton({ cashier = false }: { cashier?: boolean }) {
  return <LoadingRegion label={cashier ? "Cargando solicitudes de emisión" : "Cargando pedidos"}><WorkspaceHeadingBones /><Filters count={cashier ? 4 : 3} boxed /><Table compact={cashier} /><div className="mt-5 flex justify-between"><div className="w-32"><Bones kind="action" /></div><div className="w-40"><Bones kind="action" /></div></div></LoadingRegion>;
}
function SectionTabsBones({ count = 4 }: { count?: number }) { return <div className={count === 5 ? "workspace-settings-tabs mt-7" : "workspace-attention-tabs mt-6"}>{Array.from({ length: count }, (_, i) => <div key={i} className="rounded-xl border border-border p-5"><Bones kind="back" /><div className="mt-3"><Bones kind="back" /></div></div>)}</div>; }
export function InventorySkeleton() {
  return <LoadingRegion label="Cargando inventario"><WorkspaceHeadingBones /><div className="workspace-stock-metrics mt-6">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Bones kind="lines" /></Card>)}</div><Filters boxed /><div className="mt-5 w-48"><Bones kind="back" /></div><Table inventory /></LoadingRegion>;
}
export function SettingsSkeleton() {
  return <LoadingRegion label="Cargando configuración"><WorkspaceHeadingBones /><SectionTabsBones count={5} /><div className="mt-7"><Bones kind="heading" /><div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]"><Card><Bones kind="lines" /><Bones kind="lines" /></Card><Card><Bones kind="field" /><div className="mt-4"><Bones kind="action" /></div></Card></div></div></LoadingRegion>;
}
export function AdminOrderSkeleton() {
  return <LoadingRegion label="Cargando atención del pedido"><div className="mb-5 w-36"><Bones kind="back" /></div><WorkspaceHeadingBones /><SectionTabsBones /><div className="mt-6 space-y-5"><Bones kind="back" /><div className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Bones kind={i === 3 ? "summary" : "lines"} /></Card>)}</div></div></LoadingRegion>;
}
export function CashierOrderSkeleton() {
  return <LoadingRegion label="Cargando solicitud de Tesorería Recaudación"><div className="mb-5 w-36"><Bones kind="back" /></div><div className="workspace-detail-heading"><div className="w-full max-w-md"><Bones kind="heading" /></div><div className="w-40"><Bones kind="action" /></div></div><div className="mt-5"><Card><Bones kind="back" /><div className="mt-4 w-32"><Bones kind="action" /></div></Card></div><div className="mt-6"><Card><Bones kind="back" /><div className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Bones key={i} kind="lines" />)}</div></Card></div><div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]"><div className="space-y-5"><div className="treasury-review-grid"><Card><Bones kind="summary" /></Card><Card><Bones kind="lines" /></Card></div><Card><Bones kind="field" /><div className="mt-4 w-36"><Bones kind="action" /></div></Card><Card><Bones kind="back" /></Card><Card><Bones kind="back" /></Card></div><aside><Card><Bones kind="preview" /><div className="mt-4"><Bones kind="action" /></div></Card></aside></div></LoadingRegion>;
}
export function TrackingSkeleton() {
  return <main id="contenido" className="public-order-surface mx-auto w-full max-w-6xl px-5 py-7 sm:px-10 sm:py-10"><LoadingRegion label="Cargando seguimiento del pedido"><Bones kind="heading" /><div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"><div className="overflow-hidden rounded-2xl border border-border"><div className="bg-secondary/40 p-5"><Bones kind="heading" /></div><div className="border-b border-border"><Bones kind="tabs" /></div><div className="space-y-4 p-5"><Card><Bones kind="summary" /></Card><Card><Bones kind="lines" /></Card></div></div><SidePanel /></div></LoadingRegion></main>;
}
export function PublicationSkeleton() {
  return <main id="contenido" className="public-order-surface mx-auto w-full max-w-6xl px-5 py-6 sm:px-10 sm:py-10"><LoadingRegion label="Cargando publicaciones"><header className="mb-7 border-b border-border pb-6 sm:mb-9 sm:pb-8"><Bones kind="heading" /></header><div className="mb-8 border-b border-border"><Bones kind="fourTabs" /></div><div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10"><div><Bones kind="heading" /><div className="my-5"><Bones kind="field" /></div><div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Bones kind="publication" /></Card>)}</div><div className="mt-6 w-32"><Bones kind="action" /></div></div><aside><Card><Bones kind="summary" /></Card></aside></div></LoadingRegion></main>;
}
export function LoginSkeleton({ checking = false }: { checking?: boolean }) {
  return <main id="contenido" className="flex min-h-[32rem] items-center justify-center px-6 py-14 sm:py-20"><div className="w-full max-w-sm"><LoadingRegion label={checking ? "Comprobando acceso" : "Cargando inicio de sesión"}><div className="mb-6 w-11"><Bones kind="action" /></div><Bones kind="heading" /><div className="mt-7"><Bones kind="action" /></div><div className="mt-7 border-t border-border pt-5"><Bones kind="lines" /></div></LoadingRegion></div></main>;
}

export function DiscountsSkeleton({ coupons = false }: { coupons?: boolean }) {
  return <LoadingRegion label={coupons ? "Cargando cupones" : "Cargando promociones"}><WorkspaceHeadingBones /><div className="workspace-table-toolbar mt-6"><div className="w-32"><Bones kind="back" /></div><div className="w-40"><Bones kind="action" /></div></div><Table /></LoadingRegion>;
}

export function DashboardSkeleton() {
  return <LoadingRegion label="Cargando indicadores"><WorkspaceHeadingBones /><div className="workspace-dashboard-sections mt-6">{Array.from({ length: 3 }, (_, i) => <Card key={i}><Bones kind="back" /><div className="mt-3"><Bones kind="back" /></div></Card>)}</div><div className="workspace-filters grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">{Array.from({length: 4}, (_, i) => <Bones key={i} kind="field" />)}<div className="w-24"><Bones kind="action" /></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length: 4}, (_, i) => <Card key={i}><Bones kind="lines" /></Card>)}</div><div className="mt-6 grid gap-5 lg:grid-cols-2">{Array.from({length: 2}, (_, i) => <Card key={i}><Bones kind="preview" /></Card>)}</div><div className="mt-6"><Card><Bones kind="preview" /></Card></div></LoadingRegion>;
}

export function TreasurySummarySkeleton() {
  return <LoadingRegion label="Cargando resumen de Tesorería Recaudación"><WorkspaceHeadingBones /><div className="workspace-inline-filters mt-6"><div className="w-44"><Bones kind="action" /></div><div className="w-48"><Bones kind="action" /></div><div className="w-20"><Bones kind="action" /></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i}><Bones kind="lines" /></Card>)}</div><div className="workspace-panel-grid mt-6"><Card><Bones kind="preview" /></Card><div className="space-y-5"><Card><Bones kind="summary" /></Card><Card><Bones kind="lines" /></Card></div></div><div className="mt-6"><Card><Bones kind="lines" /></Card></div></LoadingRegion>;
}
export function GuideSkeleton({ treasury = false }: { treasury?: boolean }) {
  return <LoadingRegion label="Cargando guía de uso"><WorkspaceHeadingBones /><div className="workspace-guide-flow mt-7"><Bones kind="back" /><div className="workspace-flow-nodes mt-6" style={{ "--flow-count": treasury ? 7 : 5 } as CSSProperties}>{Array.from({ length: treasury ? 7 : 5 }, (_, i) => <div key={i} className="rounded-xl border border-border p-4"><Bones kind="lines" /></div>)}</div></div><div className="workspace-panel-grid mt-6"><Card><Bones kind="heading" /><Bones kind="lines" /><Bones kind="lines" /></Card><div className="space-y-5"><Card><Bones kind="lines" /></Card><Card><Bones kind="lines" /></Card></div></div></LoadingRegion>;
}
