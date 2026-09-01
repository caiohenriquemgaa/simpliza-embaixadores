export const META_PIXEL_CONSENT_KEY = "simpliza_meta_pixel_consent";

type MetaPixelData = Record<string, unknown>;
type PendingMetaEvent = { event: string; data?: MetaPixelData };

declare global {
  interface Window {
    _fbq?: unknown;
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      loaded?: boolean;
      push?: (...args: unknown[]) => void;
      queue?: unknown[][];
      version?: string;
    };
    dataLayer?: Record<string, unknown>[];
    simplizaMetaPixelQueue?: PendingMetaEvent[];
  }
}

function hasTrackingConsent() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(META_PIXEL_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

function sendMetaEvent(event: string, data?: MetaPixelData) {
  if (typeof window.fbq !== "function") return false;

  try {
    if (data) window.fbq("track", event, data);
    else window.fbq("track", event);
    return true;
  } catch (error) {
    console.error(`[meta-pixel] Falha ao enviar ${event}.`, error);
    return false;
  }
}

export function trackMetaEvent(event: string, data?: MetaPixelData) {
  if (!hasTrackingConsent()) return false;
  if (sendMetaEvent(event, data)) return true;

  window.simplizaMetaPixelQueue ??= [];
  window.simplizaMetaPixelQueue.push({ event, data });
  return false;
}

export function flushMetaPixelQueue() {
  if (!hasTrackingConsent() || typeof window.fbq !== "function") return 0;

  const pending = window.simplizaMetaPixelQueue?.splice(0) ?? [];
  let sent = 0;

  for (const item of pending) {
    if (sendMetaEvent(item.event, item.data)) sent += 1;
  }

  return sent;
}

export function trackDataLayerEvent(data: Record<string, unknown>) {
  try {
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    window.dataLayer.push(data);
    return true;
  } catch (error) {
    console.error("[data-layer] Falha ao registrar evento.", error);
    return false;
  }
}
