import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig, isUsableEnvValue } from "./env.ts";

export function isSupabaseConfigured() {
  return Boolean(getPublicSupabaseConfig());
}

export function createPublicSupabaseClient() {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceSupabaseClient() {
  const config = getPublicSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!config || !isUsableEnvValue(secretKey)) return null;
  return createClient(config.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
