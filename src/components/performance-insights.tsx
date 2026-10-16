"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

const staticRoutes = new Set([
  "/", "/pedido", "/login", "/acceso", "/admin", "/admin/pedidos",
  "/admin/reporte", "/admin/inventario", "/admin/promociones", "/admin/cupones",
  "/admin/configuracion", "/admin/guia", "/tesoreria-recaudacion",
  "/tesoreria-recaudacion/reporte", "/tesoreria-recaudacion/guia",
]);

export function PerformanceInsights() {
  return (
    <SpeedInsights
      beforeSend={(event) => {
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
      }}
    />
  );
}
