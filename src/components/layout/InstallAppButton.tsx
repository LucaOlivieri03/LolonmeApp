"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import {
  detectPwaPlatform,
  isStandaloneDisplayMode,
  resolveInstallAction,
  type BeforeInstallPromptEvent,
  type PwaPlatform,
} from "@/lib/pwa/install";
import { cn } from "@/lib/utils";

const IOS_BANNER_DISMISSED_COOKIE = "lolonme-ios-install-dismissed";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function readIosBannerDismissedCookie(): boolean {
  return document.cookie
    .split("; ")
    .some((row) => row === `${IOS_BANNER_DISMISSED_COOKIE}=1`);
}

function persistIosBannerDismissedCookie() {
  document.cookie = `${IOS_BANNER_DISMISSED_COOKIE}=1; path=/; max-age=${THIRTY_DAYS_SECONDS}; samesite=lax`;
}

export function InstallAppButton() {
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>("desktop");
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isPrompting, setIsPrompting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [iosBannerDismissed, setIosBannerDismissed] = useState(true);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);

    const detectedPlatform = detectPwaPlatform(
      navigator.userAgent,
      navigator.maxTouchPoints ?? 0
    );
    setPlatform(detectedPlatform);

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const navWithStandalone = navigator as Navigator & {
      standalone?: boolean;
    };

    const syncStandalone = () => {
      setIsStandalone(
        isStandaloneDisplayMode({
          matchMediaStandalone: standaloneQuery.matches,
          navigatorStandalone: navWithStandalone.standalone,
        })
      );
    };

    syncStandalone();

    setIosBannerDismissed(readIosBannerDismissedCookie());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setModalOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener?.("change", syncStandalone);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener?.("change", syncStandalone);
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setModalOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const dialogEl = dialogRef.current;
      if (!dialogEl) return;

      const focusable = Array.from(
        dialogEl.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !dialogEl.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !dialogEl.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  if (!mounted) {
    return null;
  }

  const action = resolveInstallAction({
    isStandalone,
    hasDeferredPrompt: Boolean(deferredPrompt),
    platform,
  });

  if (action === "hidden") {
    return null;
  }

  const handleInstallClick = async () => {
    if (action === "native-prompt" && deferredPrompt) {
      setIsPrompting(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === "accepted") {
          setIsStandalone(true);
        }
      } catch {
        setModalOpen(true);
      } finally {
        setIsPrompting(false);
      }
      return;
    }

    setModalOpen(true);
  };

  const handleDismissIosBanner = () => {
    setIosBannerDismissed(true);
    persistIosBannerDismissedCookie();
  };

  const showIosBanner =
    platform === "ios-safari" && !iosBannerDismissed && !modalOpen;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleInstallClick}
        disabled={isPrompting}
        title="Descargar aplicación"
        aria-label="Descargar aplicación"
        className={cn(
          "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors sm:px-2.5",
          "border-gold-400/50 bg-pitch-900/80 text-gold-400 hover:border-gold-400 hover:bg-pitch-900 disabled:opacity-60"
        )}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Descargar</span>
      </button>

      {showIosBanner &&
        createPortal(
          <aside
            aria-label="Instalar aplicación en iOS"
            className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-rule-strong bg-surface p-3 text-ink md:bottom-4"
          >
            <img
              src="/icon-192x192.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-md border border-rule"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink">
                Instala LOLONMEBOL en tu iPhone
              </p>
              <p className="text-[11px] leading-snug text-ink-muted">
                Ábrela en pantalla completa desde tu inicio.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex min-h-10 shrink-0 items-center rounded-md bg-pitch-800 px-3 text-xs font-bold text-white transition-colors hover:bg-pitch-900"
            >
              Descargar
            </button>
            <button
              type="button"
              onClick={handleDismissIosBanner}
              aria-label="Cerrar aviso de instalación"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </aside>,
          document.body
        )}

      {modalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-pwa-title"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setModalOpen(false);
                triggerRef.current?.focus();
              }
            }}
          >
            <div
              ref={dialogRef}
              className="w-full max-w-md rounded-lg border border-rule-strong bg-surface text-ink"
            >
              <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/icon-192x192.png"
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-md border border-rule"
                  />
                  <div>
                    <h2
                      id="install-pwa-title"
                      className="font-display text-lg font-bold tracking-wide text-ink"
                    >
                      Descargar LOLONMEBOL
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Úsala como app en pantalla completa
                    </p>
                  </div>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    triggerRef.current?.focus();
                  }}
                  aria-label="Cerrar instrucciones de descarga"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3 p-4 text-sm">
                {action === "ios-guide" ? (
                  <>
                    <ol className="space-y-2.5">
                      <li className="flex items-start gap-3 rounded-md border border-rule bg-surface-subtle p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pitch-800 text-xs font-bold text-white">
                          1
                        </span>
                        <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
                          Toca el ícono de{" "}
                          <span className="inline-flex items-center gap-1 rounded-sm border border-rule-strong bg-surface px-1.5 py-0.5 font-bold text-ink">
                            <Share className="h-3.5 w-3.5 text-pitch-800" aria-hidden="true" />
                            Compartir
                          </span>{" "}
                          en la barra inferior de Safari.
                        </div>
                      </li>
                      <li className="flex items-start gap-3 rounded-md border border-rule bg-surface-subtle p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pitch-800 text-xs font-bold text-white">
                          2
                        </span>
                        <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
                          Desliza hacia abajo y selecciona{" "}
                          <span className="inline-flex items-center gap-1 rounded-sm border border-rule-strong bg-surface px-1.5 py-0.5 font-bold text-ink">
                            <PlusSquare className="h-3.5 w-3.5 text-pitch-800" aria-hidden="true" />
                            Agregar a inicio
                          </span>
                          .
                        </div>
                      </li>
                      <li className="flex items-start gap-3 rounded-md border border-rule bg-surface-subtle p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pitch-800 text-xs font-bold text-white">
                          3
                        </span>
                        <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
                          Toca <strong>Agregar</strong> arriba a la derecha. El
                          ícono de LOLONMEBOL aparecerá en tu pantalla de inicio.
                        </div>
                      </li>
                    </ol>
                    {platform === "ios-other" && (
                      <p className="rounded-md border border-rule bg-surface-subtle px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
                        Si no ves la opción &ldquo;Agregar a inicio&rdquo;, abre
                        esta página directamente en <strong>Safari</strong>.
                      </p>
                    )}
                  </>
                ) : (
                  <ol className="space-y-2.5">
                    <li className="flex items-start gap-3 rounded-md border border-rule bg-surface-subtle p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pitch-800 text-xs font-bold text-white">
                        1
                      </span>
                      <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
                        Abre el menú de tu navegador{" "}
                        <span className="inline-flex items-center gap-0.5 rounded-sm border border-rule-strong bg-surface px-1.5 py-0.5 font-bold text-ink">
                          <MoreVertical className="h-3.5 w-3.5 text-pitch-800" aria-hidden="true" />
                          Menú
                        </span>{" "}
                        en la esquina superior derecha.
                      </div>
                    </li>
                    <li className="flex items-start gap-3 rounded-md border border-rule bg-surface-subtle p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pitch-800 text-xs font-bold text-white">
                        2
                      </span>
                      <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
                        Selecciona{" "}
                        <span className="inline-flex items-center gap-1 rounded-sm border border-rule-strong bg-surface px-1.5 py-0.5 font-bold text-ink">
                          <Smartphone className="h-3.5 w-3.5 text-pitch-800" aria-hidden="true" />
                          Instalar aplicación
                        </span>{" "}
                        o <strong>Agregar a la pantalla principal</strong>.
                      </div>
                    </li>
                  </ol>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-pitch-800 px-4 text-xs font-bold text-white transition-colors hover:bg-pitch-900"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
