import type { Metadata } from "next";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/newsreader";
import "sileo/styles.css";
import "./globals.css";
import { ToastProvider } from "@/components/toast-provider";

export const metadata: Metadata = {
  title: { default: "Fondo Editorial Continental", template: "%s · Fondo Editorial Continental" },
  description: "Administración del Fondo Editorial Continental.",
  robots: { index: false, follow: false },
};

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
