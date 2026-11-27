import "server-only";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  parseHttpOrigin,
  resolveSafeAppOrigin,
  sanitizeRedirectPath,
} from "./redirect";

const VALID_EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export interface CallbackAuthClient {
  auth: {
    exchangeCodeForSession: (
      authCode: string
    ) => Promise<{ error: { message: string } | null }>;
    verifyOtp: (params: {
      token_hash: string;
      type: EmailOtpType;
    }) => Promise<{ error: { message: string } | null }>;
  };
}

export interface AuthCallbackResolution {
  redirectTo: string;
  ok: boolean;
}

/**
 * Pure server-side handler for `/auth/callback` supporting both PKCE (`code`)
 * and token-hash (`token_hash` + `type`) Supabase email links.
 */
export async function resolveAuthCallback(
  requestUrl: string,
  client: CallbackAuthClient | null,
  safeOrigin?: string
): Promise<AuthCallbackResolution> {
  const url = new URL(requestUrl);
  const origin =
    parseHttpOrigin(safeOrigin) ??
    resolveSafeAppOrigin({
      hostHeader: url.host,
      protoHeader: url.protocol.replace(":", ""),
    });
  const nextPath = sanitizeRedirectPath(url.searchParams.get("next"), "/perfil");

  const buildErrorRedirect = (reason: string): AuthCallbackResolution => {
    const errUrl = new URL("/perfil", origin);
    errUrl.searchParams.set("authError", reason);
    return {
      redirectTo: errUrl.toString(),
      ok: false,
    };
  };

  if (!client) {
    return buildErrorRedirect("not_configured");
  }

  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    return buildErrorRedirect("provider_error");
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      return buildErrorRedirect("invalid_or_expired_link");
    }
    return {
      redirectTo: new URL(nextPath, origin).toString(),
      ok: true,
    };
  }

  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  if (tokenHash && rawType && VALID_EMAIL_OTP_TYPES.has(rawType as EmailOtpType)) {
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType as EmailOtpType,
    });
    if (error) {
      return buildErrorRedirect("invalid_or_expired_link");
    }
    return {
      redirectTo: new URL(nextPath, origin).toString(),
      ok: true,
    };
  }

  return buildErrorRedirect("missing_code");
}
