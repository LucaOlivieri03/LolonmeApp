import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PwaRegistrar } from "@/components/layout/PwaRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "LolonmeApp — Torneo Oficial LOLONMEBOL",
  description:
    "Hub digital mobile-first del torneo LOLONMEBOL: Liga Anual, Tabla Histórica, Copa, Estadísticas Grupales, Calendario y Administración.",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/LogoLOLONMEBOL.svg",
    apple: "/assets/LogoLOLONMEBOL.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#007934",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#f4f7f4] text-[#0f1c14] antialiased">
        <PwaRegistrar />
        <AppHeader />
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-5xl px-3 pt-4 pb-24 sm:px-5">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
