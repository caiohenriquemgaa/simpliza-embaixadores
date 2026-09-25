import { META_PIXEL_CONSENT_KEY } from "./meta-pixel.ts";

export const OPENAI_PIXEL_ID = "L1f8X3pfviH8puvdcxZLSR";
export const OPENAI_PIXEL_SRC = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
export const TRACKING_CONSENT_EVENT = "simpliza:tracking_consent";
const REPORTED_KEY = "simpliza_openai_leads_v1";

declare global {
  interface Window {
    oaiq?: ((...args: unknown[]) => void) & { q?: unknown[][] };
    simplizaOpenAiInitialized?: boolean;
    simplizaOpenAiReported?: Set<string>;
  }
}

export function isInstitutionalPath(pathname: string) {
  return pathname === "/" || pathname === "/inicio" || pathname === "/inicio/";
}

function hasConsent() {
  try { return window.localStorage.getItem(META_PIXEL_CONSENT_KEY) === "accepted"; }
  catch { return false; }
}

// The official queue preserves commands until next/script loads the SDK.
// No user object, automatic-matching override, or hand-managed oppref cookie.
export function initializeOpenAiPixel({ debug = false }: { debug?: boolean } = {}) {
  if (typeof window === "undefined" || window.simplizaOpenAiInitialized) return;
  if (!window.oaiq) {
    const queue = (...args: unknown[]) => { queue.q.push(args); };
    queue.q = [] as unknown[][];
    window.oaiq = queue;
  }
  window.oaiq("consent", hasConsent());
  window.oaiq("init", { pixelId: OPENAI_PIXEL_ID, ...(debug ? { debug: true } : {}) });
  window.simplizaOpenAiInitialized = true;
}

function remember(id: string) {
  window.simplizaOpenAiReported ??= new Set<string>();
  const reported = window.simplizaOpenAiReported;
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(REPORTED_KEY) || "[]");
    if (Array.isArray(saved)) saved.filter(value => typeof value === "string").forEach(value => reported.add(value));
  } catch { /* In-memory deduplication still works when storage is unavailable. */ }
  if (reported.has(id)) return false;
  reported.add(id);
  try { window.sessionStorage.setItem(REPORTED_KEY, JSON.stringify([...reported])); } catch {}
  return true;
}

export function measureOpenAiLead(detail: { event_id?: string; source_type?: string }) {
  if (typeof window === "undefined" || !window.simplizaOpenAiInitialized || !window.oaiq
    || !isInstitutionalPath(window.location.pathname) || detail.source_type !== "institutional"
    || !detail.event_id || !remember(detail.event_id)) return false;
  // A lead accepted without consent must never be replayed after consent changes.
  if (!hasConsent()) return false;
  window.oaiq("measure", "lead_created", { type: "customer_action" }, { event_id: detail.event_id });
  return true;
}

export function subscribeOpenAiPixel() {
  const consent = () => window.oaiq?.("consent", hasConsent());
  const lead = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail && typeof detail === "object") measureOpenAiLead(detail);
  };
  window.addEventListener(TRACKING_CONSENT_EVENT, consent);
  window.addEventListener("storage", consent);
  window.addEventListener("simpliza:lead_submitted", lead);
  return () => {
    window.removeEventListener(TRACKING_CONSENT_EVENT, consent);
    window.removeEventListener("storage", consent);
    window.removeEventListener("simpliza:lead_submitted", lead);
  };
}
