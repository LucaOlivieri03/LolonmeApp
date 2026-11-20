"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { AnthemPlayer } from "./AnthemPlayer";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-pitch-700/15 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/assets/LogoLOLONMEBOL.svg"
            alt="Logo oficial LOLONMEBOL"
            className="h-9 w-9 shrink-0 object-contain drop-shadow-xs"
          />
          <div className="leading-tight">
            <span className="block text-sm font-black tracking-tight text-navy-900 sm:text-base">
              LOLONMEBOL
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-pitch-700">
              Torneo Oficial
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <AnthemPlayer />
          <Link
            href="/admin"
            aria-label="Panel de Administración"
            className="inline-flex items-center gap-1 rounded-full border border-navy-800/15 bg-navy-50 px-2.5 py-1.5 text-xs font-semibold text-navy-800 transition-colors hover:bg-navy-100"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
