import type { Metadata, Viewport } from "next";
import { Archivo, Barlow_Condensed } from "next/font/google";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PwaRegistrar } from "@/components/layout/PwaRegistrar";
import { TournamentProvider } from "@/components/providers/TournamentProvider";
import { getViewerSession } from "@/server/auth";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LolonmeApp — Torneo Oficial LOLONMEBOL",
  description:
    "Hub digital mobile-first del torneo LOLONMEBOL: Liga Anual, Tabla Histórica, Copa, Estadísticas Grupales, Calendario y Administración.",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/Logo.svg",
    apple: "/assets/Logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a4a28",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getViewerSession();

  return (
    <html
      lang="es"
      className={`${archivo.variable} ${barlowCondensed.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink antialiased">
        <TournamentProvider>
          <PwaRegistrar />
          <AppHeader
            role={session.role}
            displayName={session.displayName}
            isAuthenticated={Boolean(session.userId)}
          />
          <main className="mx-auto min-h-[calc(100vh-3.75rem)] max-w-5xl px-3 pt-4 pb-24 sm:px-5 md:pb-12">
            {children}
          </main>
          <BottomNav />
        </TournamentProvider>
      </body>
    </html>
  );
}
