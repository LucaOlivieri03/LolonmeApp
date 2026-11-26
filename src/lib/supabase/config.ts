function isTruthyEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export function isLocalSeedOverrideEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return (
    isTruthyEnvFlag(process.env.LOLONME_LOCAL_SEED) ||
    isTruthyEnvFlag(process.env.NEXT_PUBLIC_LOCAL_SEED)
  );
}

export function getSupabaseEnv() {
  if (isLocalSeedOverrideEnabled()) {
    return null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseEnv());
}
