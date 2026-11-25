"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  UserCheck,
} from "lucide-react";
import type { AuthFormActionState } from "@/lib/types/view-models";
import {
  requestEmailOtpAction,
  signInWithPasswordAction,
  verifyEmailOtpAction,
} from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const INITIAL_STATE: AuthFormActionState = { status: "idle" };

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_link:
    "El enlace de acceso venció o ya fue utilizado. Solicitá uno nuevo abajo.",
  provider_error:
    "No se pudo completar la validación con el proveedor de correo. Intentá nuevamente.",
  missing_code: "Falta el código de verificación en el enlace recibido.",
  not_configured:
    "Supabase Auth no está configurado en este entorno todavía.",
};

interface OtpCodeVerifyFormProps {
  email: string;
  requestMessage?: string;
}

function OtpCodeVerifyForm({ email, requestMessage }: OtpCodeVerifyFormProps) {
  const [otpVerifyState, otpVerifyAction, isVerifyingOtp] = useActionState(
    verifyEmailOtpAction,
    INITIAL_STATE
  );

  const isVerifyError =
    otpVerifyState.status === "otp_sent" && Boolean(otpVerifyState.message);

  return (
    <form
      action={otpVerifyAction}
      className="space-y-3 rounded-md border border-pitch-200 bg-pitch-50/60 p-4"
    >
      <input type="hidden" name="email" value={email} />
      <div
        role={isVerifyError ? "alert" : "status"}
        className={cn(
          "flex items-start gap-2 text-xs",
          isVerifyError ? "font-medium text-crimson-700" : "text-pitch-900"
        )}
      >
        {isVerifyError ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-crimson-700" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pitch-700" />
        )}
        <span>
          {otpVerifyState.message ??
            requestMessage ??
            `Revisá la bandeja de ${email}.`}
        </span>
      </div>

      <div>
        <label
          htmlFor="login-otp-code"
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-pitch-900"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Código numérico (opcional si no abrís el enlace)
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="login-otp-code"
            name="token"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6,8}"
            maxLength={8}
            required
            placeholder="123456"
            className="min-h-11 flex-1 rounded-md border border-rule bg-surface px-3 font-mono text-base tracking-widest text-ink focus:border-pitch-700 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isVerifyingOtp}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-leather-600 px-4 text-xs font-extrabold text-white transition-colors hover:bg-leather-700 disabled:opacity-60"
          >
            {isVerifyingOtp ? "Validando..." : "Verificar código"}
          </button>
        </div>
      </div>
    </form>
  );
}

export interface LoginCardProps {
  isAuthConfigured: boolean;
  callbackError?: string;
}

export function LoginCard({
  isAuthConfigured,
  callbackError,
}: LoginCardProps) {
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [emailInput, setEmailInput] = useState("");

  const [otpReqState, otpReqAction, isRequestingOtp] = useActionState(
    requestEmailOtpAction,
    INITIAL_STATE
  );
  const [pwdState, pwdAction, isSigningInPwd] = useActionState(
    signInWithPasswordAction,
    INITIAL_STATE
  );

  const normalizedDraftEmail = emailInput.trim().toLowerCase();
  const requestedEmail = otpReqState.email ?? "";
  const isOtpActiveForCurrentEmail =
    mode === "otp" &&
    otpReqState.status === "otp_sent" &&
    Boolean(requestedEmail) &&
    (normalizedDraftEmail === "" || normalizedDraftEmail === requestedEmail);

  const callbackErrorMessage = callbackError
    ? (CALLBACK_ERROR_MESSAGES[callbackError] ??
      "No se pudo iniciar sesión. Intentá nuevamente.")
    : null;

  return (
    <section className="mx-auto max-w-xl rounded-lg border border-rule bg-surface p-6 sm:p-8">
      <div className="text-center">
        <UserCheck className="mx-auto h-10 w-10 text-pitch-700" />
        <h2 className="font-display mt-3 text-2xl font-extrabold tracking-wide text-ink">
          Acceso Oficial de Jugadores
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
          Ingresá con el correo asociado a tu ficha del padrón LOLONMEBOL para
          ver tu resumen personal, estrellas y permisos de torneo.
        </p>
      </div>

      {!isAuthConfigured && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-leather-600/40 bg-gold-50 p-3 text-xs text-ink"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-leather-700" />
          <span>
            Las variables de entorno de Supabase Auth no están definidas en este
            servidor. Configuralas para habilitar el inicio de sesión real.
          </span>
        </div>
      )}

      {callbackErrorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-crimson-600/30 bg-crimson-50 p-3 text-xs font-medium text-crimson-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{callbackErrorMessage}</span>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Método de acceso"
        className="mt-5 grid grid-cols-2 rounded-md border border-rule bg-paper p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "otp"}
          onClick={() => setMode("otp")}
          className={cn(
            "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sm px-3 text-xs font-bold transition-colors",
            mode === "otp"
              ? "bg-pitch-800 text-white"
              : "text-ink-muted hover:text-ink"
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          Enlace / Código por Email
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          onClick={() => setMode("password")}
          className={cn(
            "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sm px-3 text-xs font-bold transition-colors",
            mode === "password"
              ? "bg-pitch-800 text-white"
              : "text-ink-muted hover:text-ink"
          )}
        >
          <Lock className="h-3.5 w-3.5" />
          Correo y Contraseña
        </button>
      </div>

      {mode === "otp" ? (
        <div className="mt-4 space-y-4">
          <form action={otpReqAction} className="space-y-3">
            <div>
              <label
                htmlFor="login-email-otp"
                className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
              >
                Correo electrónico
              </label>
              <input
                id="login-email-otp"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="jugador@ejemplo.com"
                className="mt-1 min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-sm text-ink focus:border-pitch-700 focus:outline-none"
              />
            </div>

            {otpReqState.status === "error" && otpReqState.message && (
              <p
                role="alert"
                className="rounded-md border border-crimson-600/30 bg-crimson-50 px-3 py-2 text-xs font-medium text-crimson-700"
              >
                {otpReqState.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isRequestingOtp || !isAuthConfigured}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-bold text-white transition-colors hover:bg-pitch-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {isRequestingOtp
                ? "Enviando enlace..."
                : isOtpActiveForCurrentEmail
                  ? "Reenviar enlace / código"
                  : "Enviar enlace de acceso"}
            </button>
          </form>

          {isOtpActiveForCurrentEmail && (
            <OtpCodeVerifyForm
              key={`${requestedEmail}:${otpReqState.sentAt ?? 0}`}
              email={requestedEmail}
              requestMessage={otpReqState.message}
            />
          )}
        </div>
      ) : (
        <form action={pwdAction} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="login-email-pwd"
              className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Correo electrónico
            </label>
            <input
              id="login-email-pwd"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="jugador@ejemplo.com"
              className="mt-1 min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-sm text-ink focus:border-pitch-700 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Contraseña
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="mt-1 min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-sm text-ink focus:border-pitch-700 focus:outline-none"
            />
          </div>

          {pwdState.status === "error" && pwdState.message && (
            <p
              role="alert"
              className="rounded-md border border-crimson-600/30 bg-crimson-50 px-3 py-2 text-xs font-medium text-crimson-700"
            >
              {pwdState.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSigningInPwd || !isAuthConfigured}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-bold text-white transition-colors hover:bg-pitch-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {isSigningInPwd ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-rule pt-4 text-center">
        <p className="text-xs text-ink-muted">
          ¿Querés consultar estadísticas individuales de cualquier jugador sin
          iniciar sesión?
        </p>
        <Link
          href="/stats?tab=player"
          className="mt-2.5 inline-flex min-h-10 items-center gap-2 rounded-md border border-rule bg-paper px-4 text-xs font-semibold text-ink transition-colors hover:border-pitch-700"
        >
          <BarChart3 className="h-4 w-4 text-pitch-700" />
          Ir a Stats por Jugador
        </Link>
      </div>
    </section>
  );
}
