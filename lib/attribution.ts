export const intents = ["gestao", "operacao", "delivery", "migracao"] as const;
export type Intent = typeof intents[number];
export type Touch = { landingUrl: string; referrer: string; capturedAt: string; parameters: Record<string, string> };
export type Attribution = { firstTouch: Touch; conversionTouch: Touch; intent: Intent | null };
const storageKey = "simpliza_attribution_v1";
let memory: { firstTouch: Touch; intent: Intent | null } | undefined;

export function parseIntent(value: string | null): Intent | null {
  return intents.includes(value as Intent) ? value as Intent : null;
}

// Keep exact incoming parameter names: no assumed proprietary ChatGPT click ID.
// Exclude common secrets/PII; bounded values also keep the API payload small.
export function captureTouch(href: string, referrer: string, now = new Date().toISOString()): Touch {
  const url = new URL(href);
  const parameters: Record<string, string> = {};
  let budget = 0;
  for (const [key, raw] of url.searchParams) {
    if (Object.keys(parameters).length >= 24 || key.length > 80 || /token|secret|password|email|phone|name|code|auth/i.test(key)) continue;
    const value = raw.slice(0, 200);
    if (budget + key.length + value.length > 1200) continue;
    parameters[key] = value;
    budget += key.length + value.length;
  }
  url.search = new URLSearchParams(parameters).toString();
  url.hash = "";
  let safeReferrer = "";
  try { const ref = new URL(referrer); safeReferrer = `${ref.origin}${ref.pathname}`.slice(0, 2048); } catch {}
  return { landingUrl: url.href.slice(0, 2048), referrer: safeReferrer, capturedAt: now, parameters };
}

export function readAttribution(): Attribution {
  const touch = captureTouch(window.location.href, document.referrer);
  if (!memory) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (stored?.firstTouch?.landingUrl && new URL(stored.firstTouch.landingUrl).origin === window.location.origin) memory = stored;
    } catch {}
  }
  const intent = parseIntent(new URL(window.location.href).searchParams.get("intent")) ?? memory?.intent ?? null;
  memory = { firstTouch: memory?.firstTouch ?? touch, intent };
  try { sessionStorage.setItem(storageKey, JSON.stringify(memory)); } catch { /* Storage can be unavailable in private mode. */ }
  return { ...memory, conversionTouch: touch };
}

export function sourceName(sourceType: "ambassador" | "institutional", slug: string | undefined, touch: Touch) {
  if (sourceType === "ambassador") return slug || "unknown";
  const source = touch.parameters.utm_source;
  return source?.toLowerCase() === "chatgpt" && touch.parameters.utm_medium === "paid_ai" ? "chatgpt_ads" : source || (touch.referrer ? "referral" : "direct");
}
