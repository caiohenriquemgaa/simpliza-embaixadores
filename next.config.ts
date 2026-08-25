import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const hasSupabaseUrl = Boolean(supabaseUrl && !supabaseUrl.startsWith("SUBSTITUA_AQUI_") && URL.canParse(supabaseUrl));
const supabaseOrigin = hasSupabaseUrl && supabaseUrl ? new URL(supabaseUrl).origin : "";
const connectSources = ["'self'", supabaseOrigin].filter(Boolean).join(" ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; connect-src ${connectSources}; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob: https:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests` },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];
const nextConfig: NextConfig = {
  images: {
    remotePatterns: hasSupabaseUrl && supabaseUrl
      ? [{ protocol: "https", hostname: new URL(supabaseUrl).hostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
