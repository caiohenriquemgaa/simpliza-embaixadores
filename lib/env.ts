const PLACEHOLDER_PREFIX = "SUBSTITUA_AQUI_";

export function isUsableEnvValue(value: string | undefined): value is string {
  return Boolean(value && !value.startsWith(PLACEHOLDER_PREFIX));
}

export function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!isUsableEnvValue(url) || !isUsableEnvValue(publishableKey)) return null;
  return { url, publishableKey };
}

export function getPublicSiteUrl(fallback = "https://simpliza.com.br") {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isUsableEnvValue(value)) return fallback;
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}
