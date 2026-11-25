import "server-only";

/**
 * Sanitizes a post-auth redirect target to prevent open-redirect vulnerabilities.
 * Allows only relative internal paths starting with a single `/` (never `//` or `/\`).
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/perfil"
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;
  return trimmed;
}

const SAFE_HOST_REGEX = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

/**
 * Resolves a trustworthy application origin for auth email callbacks,
 * preferring explicit environment configuration over request headers.
 */
export function resolveSafeAppOrigin(options?: {
  siteUrlEnv?: string;
  vercelUrlEnv?: string;
  hostHeader?: string | null;
  protoHeader?: string | null;
}): string {
  const explicitSite = options?.siteUrlEnv ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (explicitSite) {
    try {
      return new URL(explicitSite).origin;
    } catch {
      // Ignore malformed env value and fall through
    }
  }

  const vercelUrl = options?.vercelUrlEnv ?? process.env.VERCEL_URL;
  if (vercelUrl && SAFE_HOST_REGEX.test(vercelUrl.trim())) {
    return `https://${vercelUrl.trim()}`;
  }

  const host = options?.hostHeader?.trim();
  if (host && SAFE_HOST_REGEX.test(host)) {
    const isLocal =
      host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto =
      options?.protoHeader === "http" || options?.protoHeader === "https"
        ? options.protoHeader
        : isLocal
          ? "http"
          : "https";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}
