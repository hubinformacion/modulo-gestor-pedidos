"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const staticRoutes = new Set([
  "/", "/pedido", "/login", "/acceso", "/admin", "/admin/pedidos",
  "/admin/reporte", "/admin/inventario", "/admin/promociones", "/admin/cupones",
  "/admin/configuracion", "/admin/guia", "/tesoreria-recaudacion",
  "/tesoreria-recaudacion/reporte", "/tesoreria-recaudacion/guia",
]);

function redactMeasurement<T extends { url: string }>(event: T): T | null {
  const url = new URL(event.url);
  let route = url.pathname;

  if (!staticRoutes.has(route)) {
    if (/^\/seguimiento\/[^/]+$/.test(route)) route = "/seguimiento/[token]";
    else if (/^\/admin\/pedidos\/[^/]+$/.test(route)) route = "/admin/pedidos/[id]";
    else if (/^\/tesoreria-recaudacion\/[^/]+$/.test(route)) route = "/tesoreria-recaudacion/[id]";
    else return null;
  }

  url.pathname = route;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString(), route };
}

export function PerformanceInsights() {
  return (
    <>
      <SpeedInsights beforeSend={redactMeasurement} />
      <Analytics beforeSend={redactMeasurement} />
    </>
  );
}
