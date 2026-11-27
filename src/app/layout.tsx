import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Archivo, Barlow_Condensed } from "next/font/google";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PwaRegistrar } from "@/components/layout/PwaRegistrar";
import type { ThemeKey } from "@/components/layout/ThemeSwitcher";
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
  title: "LOLONMEAPP - Sitio oficial de la LOLONMEBOL",
  description:
    "Hub digital mobile-first del torneo LOLONMEBOL: Liga, Tabla Histórica, Copa, Estadísticas Grupales, Calendario y Administración.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/Logo.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LOLONMEBOL",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a4a28",
  width: "device-width",
  initialScale: 1,
};

const VALID_THEMES = new Set<ThemeKey>(["estadio", "salvia", "diario"]);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, cookieStore] = await Promise.all([
    getViewerSession(),
    cookies(),
  ]);
  const rawTheme = cookieStore.get("lolonme-theme")?.value;
  const activeTheme: ThemeKey =
    rawTheme && VALID_THEMES.has(rawTheme as ThemeKey)
      ? (rawTheme as ThemeKey)
      : "estadio";

  return (
    <html
      lang="es"
      data-theme={activeTheme}
      suppressHydrationWarning
      className={`${archivo.variable} ${barlowCondensed.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:border-gold-400 focus:bg-pitch-900 focus:px-3.5 focus:py-2 focus:text-xs focus:font-bold focus:text-white"
        >
          Ir al contenido principal
        </a>
        <PwaRegistrar />
        <AppHeader
          role={session.role}
          displayName={session.displayName}
          isAuthenticated={Boolean(session.userId)}
          initialTheme={activeTheme}
        />
        <main
          id="main-content"
          className="mx-auto min-h-[calc(100vh-3.75rem)] max-w-5xl px-3 pt-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:px-5 md:pb-12"
        >
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
