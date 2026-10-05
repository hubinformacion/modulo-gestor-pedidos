import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "sileo/styles.css";
import "./globals.css";
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
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
