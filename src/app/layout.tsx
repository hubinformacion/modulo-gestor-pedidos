import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "sileo/styles.css";
import "filepond/dist/filepond.min.css";
import "./globals.css";
import { IframeHeightBridge } from "@/components/iframe/height-bridge";
import { getWordPressOrigins } from "@/integrations/wordpress/config";
import { ToastProvider } from "@/components/feedback/toast-provider";
import { PerformanceInsights } from "@/components/performance-insights";

export const metadata: Metadata = {
  title: { default: "Gestor de pedidos", template: "%s · Gestor de pedidos" },
  description: "Gestión de pedidos y acceso del equipo.",
  robots: { index: false, follow: false },
  icons: { icon: { url: "/isotipo.svg", type: "image/svg+xml" } },
};

export const viewport: Viewport = { colorScheme: "light", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="antialiased">
      <body>
        <a className="skip-link" href="#contenido">Ir al contenido</a>
        <div id="app-content" className="flow-root">{children}</div>
        <IframeHeightBridge allowedOrigins={getWordPressOrigins()} />
        <ToastProvider />
        <PerformanceInsights />
      </body>
    </html>
  );
}
