"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  LogIn,
  Mail,
} from "lucide-react";
import type { AuthFormActionState } from "@/lib/types/view-models";
import {
  requestEmailOtpAction,
  signInWithGoogleAction,
  verifyEmailOtpAction,
} from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const INITIAL_STATE: AuthFormActionState = { status: "idle" };

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_link:
    "El enlace o código de acceso venció o ya fue utilizado. Intentá nuevamente.",
  provider_error:
    "No se pudo completar el inicio de sesión con Google o el proveedor externo. Intentá nuevamente.",
  missing_code: "Falta el código de verificación en la respuesta de acceso.",
  not_configured:
    "Supabase Auth no está configurado en este entorno todavía.",
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12Z"
      />
      <path
        fill="#34A853"
        d="M3.6 7.8l3.2 2.3C7.7 8.1 9.7 5.9 12 5.9c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 8.3 2.5 5.1 4.6 3.6 7.8Z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.5c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1.1-3.4 1.1-3.7 0-5.1-2.5-5.4-3.7l-3.2 2.4c1.5 3.1 4.8 4.9 8.6 4.9Z"
      />
      <path
        fill="#4285F4"
        d="M21.1 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.1-1.1 2.2-2 2.8l2.9 2.4c1.7-1.6 2.8-4 2.8-7.5Z"
      />
    </svg>
  );
}

function GoogleSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-md bg-pitch-800 px-4 text-sm font-bold text-white transition-colors hover:bg-pitch-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-white">
        <GoogleMark />
      </span>
      <span>
        {pending ? "Redirigiendo a Google..." : "Continuar con Google"}
      </span>
    </button>
  );
}

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
      className="space-y-3 rounded-md bg-pitch-50/70 p-4"
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
            className="min-h-11 flex-1 rounded-md border border-rule bg-surface px-3 font-mono text-base tracking-widest text-ink focus:border-pitch-700 sm:text-sm"
          />
          <button
            type="submit"
            disabled={isVerifyingOtp}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-leather-700 px-4 text-xs font-extrabold text-white transition-colors hover:bg-leather-800 disabled:opacity-60"
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
  const [showEmailOption, setShowEmailOption] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const [otpReqState, otpReqAction, isRequestingOtp] = useActionState(
    requestEmailOtpAction,
    INITIAL_STATE
  );

  const normalizedDraftEmail = emailInput.trim().toLowerCase();
  const requestedEmail = otpReqState.email ?? "";
  const isOtpActiveForCurrentEmail =
    otpReqState.status === "otp_sent" &&
    Boolean(requestedEmail) &&
    (normalizedDraftEmail === "" || normalizedDraftEmail === requestedEmail);

  const isEmailExpanded = showEmailOption || otpReqState.status !== "idle";

  const callbackErrorMessage = callbackError
    ? (CALLBACK_ERROR_MESSAGES[callbackError] ??
      "No se pudo iniciar sesión. Intentá nuevamente.")
    : null;

  return (
    <section className="mx-auto max-w-xl rounded-lg border border-rule bg-surface p-6 sm:p-8">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/LogoLOLONMEBOL.svg"
          alt="Logo oficial LOLONMEBOL"
          className="mx-auto h-24 w-auto object-contain sm:h-28"
        />
        <h2 className="font-display mt-3 text-2xl font-extrabold tracking-wide text-ink">
          Acceso oficial de jugadores
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
          Entrá con tu cuenta de Google para vincular tu ficha del padrón
          LOLONMEBOL, consultar tus estrellas y habilitar permisos de torneo.
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

      <form action={signInWithGoogleAction} className="mt-5">
        <GoogleSubmitButton disabled={!isAuthConfigured} />
      </form>
      <p className="mt-2 text-center text-xs text-ink-muted">
        Si tu email ya figura en el padrón, quedás vinculado automáticamente. Si
        no, vas a poder elegir quién sos tras ingresar.
      </p>

      <div className="mt-5 border-t border-rule pt-4">
        <button
          type="button"
          aria-expanded={isEmailExpanded}
          onClick={() => setShowEmailOption((prev) => !prev)}
          className="inline-flex min-h-10 w-full items-center justify-between rounded-md bg-paper px-3.5 text-xs font-bold text-ink transition-colors hover:text-pitch-800"
        >
          <span className="inline-flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-pitch-700" />
            Alternativa: ingresar con código o enlace por email
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-ink-muted transition-transform",
              isEmailExpanded && "rotate-180"
            )}
          />
        </button>

        {isEmailExpanded && (
          <div className="mt-3 space-y-4">
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
                  className="mt-1 min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink focus:border-pitch-700 sm:text-sm"
                />
              </div>

              {otpReqState.status === "error" && otpReqState.message && (
                <p
                  role="alert"
                  className="rounded-md bg-crimson-50 px-3 py-2 text-xs font-medium text-crimson-700"
                >
                  {otpReqState.message}
                </p>
              )}

              <button
                type="submit"
                disabled={isRequestingOtp || !isAuthConfigured}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-rule bg-paper px-4 text-sm font-bold text-ink transition-colors hover:border-pitch-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn className="h-4 w-4 text-pitch-700" />
                {isRequestingOtp
                  ? "Enviando enlace..."
                  : isOtpActiveForCurrentEmail
                    ? "Reenviar enlace / código"
                    : "Enviar código o enlace de acceso"}
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
        )}
      </div>

      <div className="mt-5 border-t border-rule pt-4 text-center">
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
