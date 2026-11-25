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

export function parseHttpOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname || parsed.hostname === "." || parsed.hostname === "..") {
      return null;
    }
    if (parsed.origin === "null") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function parseBareHostAsHttpsOrigin(
  rawHost: string | null | undefined
): string | null {
  if (!rawHost) return null;
  const trimmed = rawHost.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("?") || trimmed.includes("#") || trimmed.includes("@")) {
    return null;
  }
  const origin = parseHttpOrigin(`https://${trimmed}`);
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === trimmed.toLowerCase() ? origin : null;
  } catch {
    return null;
  }
}

function parseRequestHost(
  rawHost: string | null | undefined
): { host: string; hostname: string } | null {
  if (!rawHost) return null;
  const trimmed = rawHost.trim();
  if (
    !trimmed ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("@")
  ) {
    return null;
  }
  try {
    const parsed = new URL(`http://${trimmed}`);
    if (parsed.host.toLowerCase() !== trimmed.toLowerCase()) {
      return null;
    }
    return {
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Resolves a trustworthy application origin for Supabase Auth callbacks:
 * - Never trusts arbitrary `Host` / `X-Forwarded-Host` headers unless they match
 *   an environment-configured deployment host OR exact loopback (`localhost` / `127.0.0.1`).
 * - Matches `hostHeader` against Vercel alias env vars (`VERCEL_PROJECT_PRODUCTION_URL`,
 *   `VERCEL_BRANCH_URL`, `VERCEL_URL`) and `NEXT_PUBLIC_SITE_URL` so PKCE `code_verifier`
 *   cookies share the exact origin of the Magic Link callback.
 */
export function resolveSafeAppOrigin(options?: {
  siteUrlEnv?: string;
  vercelProdUrlEnv?: string;
  vercelBranchUrlEnv?: string;
  vercelUrlEnv?: string;
  hostHeader?: string | null;
  protoHeader?: string | null;
}): string {
  const explicitSiteOrigin = parseHttpOrigin(
    options?.siteUrlEnv !== undefined
      ? options.siteUrlEnv
      : process.env.NEXT_PUBLIC_SITE_URL
  );

  const vercelProdOrigin = parseBareHostAsHttpsOrigin(
    options?.vercelProdUrlEnv !== undefined
      ? options.vercelProdUrlEnv
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
  );

  const vercelBranchOrigin = parseBareHostAsHttpsOrigin(
    options?.vercelBranchUrlEnv !== undefined
      ? options.vercelBranchUrlEnv
      : process.env.VERCEL_BRANCH_URL
  );

  const vercelDeploymentOrigin = parseBareHostAsHttpsOrigin(
    options?.vercelUrlEnv !== undefined
      ? options.vercelUrlEnv
      : process.env.VERCEL_URL
  );

  const trustedEnvOrigins = [
    explicitSiteOrigin,
    vercelProdOrigin,
    vercelBranchOrigin,
    vercelDeploymentOrigin,
  ].filter((origin): origin is string => origin !== null);

  const parsedReqHost = parseRequestHost(options?.hostHeader);
  if (parsedReqHost) {
    // 1. If the incoming Host matches any env-allowlisted origin (e.g. production alias vs preview URL),
    // return that exact trusted origin so PKCE cookies match the Magic Link host.
    const matchedTrusted = trustedEnvOrigins.find((origin) => {
      try {
        return new URL(origin).host.toLowerCase() === parsedReqHost.host;
      } catch {
        return false;
      }
    });
    if (matchedTrusted) {
      return matchedTrusted;
    }

    // 2. Allow exact loopback (`localhost` / `127.0.0.1`) when no explicit non-loopback site URL overrides it.
    const isExactLoopback =
      parsedReqHost.hostname === "localhost" ||
      parsedReqHost.hostname === "127.0.0.1";
    if (isExactLoopback && !explicitSiteOrigin) {
      const proto = options?.protoHeader === "https" ? "https" : "http";
      return `${proto}://${parsedReqHost.host}`;
    }
  }

  return trustedEnvOrigins[0] ?? "http://localhost:3000";
}
