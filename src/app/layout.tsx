import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "sileo/styles.css";
import "filepond/dist/filepond.min.css";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css";
import "./globals.css";
import { IframeHeightBridge } from "@/components/iframe/height-bridge";
import { getWordPressOrigins } from "@/lib/iframe/config";
import { ToastProvider } from "@/components/toast-provider";

export const metadata: Metadata = {
  title: { default: "Gestor de pedidos", template: "%s · Gestor de pedidos" },
  description: "Gestión de pedidos y acceso del equipo.",
  robots: { index: false, follow: false },
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
      </body>
    </html>
  );
}
