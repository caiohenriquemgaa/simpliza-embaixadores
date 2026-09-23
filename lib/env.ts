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

export function getPublicSiteUrl(fallback = "https://www.embaixadorsimpliza.com.br") {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isUsableEnvValue(value)) return fallback;
  try {
    const url = new URL(value);
    // The institutional corporate site does not host this project's routes.
    if (["simpliza.com.br", "www.simpliza.com.br"].includes(url.hostname)) return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}
