import "server-only";
import { parseHttpOrigin } from "./redirect";

export interface AuthActionState {
  status: "idle" | "otp_sent" | "error";
  email?: string;
  message?: string;
  sentAt?: number;
}

export interface ServerAuthActionsClient {
  auth: {
    signInWithOtp: (params: {
      email: string;
      options?: {
        shouldCreateUser?: boolean;
        emailRedirectTo?: string;
      };
    }) => Promise<{ error: { message: string } | null }>;
    verifyOtp: (params: {
      email: string;
      token: string;
      type: "email";
    }) => Promise<{ error: { message: string } | null }>;
    signInWithPassword: (params: {
      email: string;
      password: string;
    }) => Promise<{ error: { message: string } | null }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let otpRequestSeq = 0;

export function normalizeEmailInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !EMAIL_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}

export async function performRequestEmailOtp(
  client: ServerAuthActionsClient | null,
  rawEmail: unknown,
  callbackOrigin: string
): Promise<AuthActionState> {
  const email = normalizeEmailInput(rawEmail);
  if (!email) {
    return {
      status: "error",
      message: "Ingresá un correo electrónico válido.",
    };
  }

  if (!client) {
    return {
      status: "error",
      email,
      message:
        "Supabase Auth no está configurado en este entorno (variables NEXT_PUBLIC_SUPABASE_* ausentes).",
    };
  }

  const safeOrigin = parseHttpOrigin(callbackOrigin) ?? "http://localhost:3000";
  const emailRedirectTo = new URL(
    "/auth/callback?next=/perfil",
    safeOrigin
  ).toString();

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  });

  if (error) {
    return {
      status: "error",
      email,
      message:
        "No se pudo enviar el enlace de acceso. Verificá el correo o intentá nuevamente en unos segundos.",
    };
  }

  otpRequestSeq = (otpRequestSeq + 1) % 1_000;
  return {
    status: "otp_sent",
    email,
    sentAt: Date.now() * 1_000 + otpRequestSeq,
    message:
      "Te enviamos un enlace mágico y un código de acceso a tu correo. Podés abrir el enlace o ingresar el código abajo.",
  };
}

export async function performVerifyEmailOtp(
  client: ServerAuthActionsClient | null,
  rawEmail: unknown,
  rawToken: unknown
): Promise<{ ok: true } | { ok: false; state: AuthActionState }> {
  const email = normalizeEmailInput(rawEmail);
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!email) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Ingresá un correo electrónico válido.",
      },
    };
  }

  if (!/^\d{6,8}$/.test(token)) {
    return {
      ok: false,
      state: {
        status: "otp_sent",
        email,
        message: "El código debe contener entre 6 y 8 dígitos numéricos.",
      },
    };
  }

  if (!client) {
    return {
      ok: false,
      state: {
        status: "error",
        email,
        message: "Supabase Auth no está configurado en este entorno.",
      },
    };
  }

  const { error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return {
      ok: false,
      state: {
        status: "otp_sent",
        email,
        message: "Código inválido o vencido. Revisá tu correo o pedí uno nuevo.",
      },
    };
  }

  return { ok: true };
}

export async function performSignInWithPassword(
  client: ServerAuthActionsClient | null,
  rawEmail: unknown,
  rawPassword: unknown
): Promise<{ ok: true } | { ok: false; state: AuthActionState }> {
  const email = normalizeEmailInput(rawEmail);
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!email || !password) {
    return {
      ok: false,
      state: {
        status: "error",
        email: email ?? undefined,
        message: "Ingresá tu correo electrónico y contraseña.",
      },
    };
  }

  if (!client) {
    return {
      ok: false,
      state: {
        status: "error",
        email,
        message: "Supabase Auth no está configurado en este entorno.",
      },
    };
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      ok: false,
      state: {
        status: "error",
        email,
        message: "Credenciales incorrectas o cuenta sin contraseña configurada.",
      },
    };
  }

  return { ok: true };
}
