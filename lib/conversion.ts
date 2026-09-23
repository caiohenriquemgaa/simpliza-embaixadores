import type { Attribution } from "./attribution";
import { trackMetaEvent, trackDataLayerEvent } from "./meta-pixel.ts";
const reported = new Set<string>();
export function reportLeadAccepted(id: string, sourceType: string, sourceName: string, attribution: Attribution, campaign?: string, ambassador?: string) {
  if (reported.has(id)) return;
  reported.add(id);
  const parameters = attribution.firstTouch.parameters;
  const data = { event_id: id, source_type: sourceType, source_name: sourceName, intent: attribution.intent,
    campaign: parameters.utm_campaign || campaign, ambassador,
    utm_source: parameters.utm_source, utm_medium: parameters.utm_medium, utm_campaign: parameters.utm_campaign,
    utm_content: parameters.utm_content, utm_term: parameters.utm_term,
    campaign_parameters: parameters, conversion_parameters: attribution.conversionTouch.parameters };
  // Keep the existing GA4/GTM event as the sole dataLayer conversion event.
  // The custom event is an integration hook, not another GA4 conversion.
  trackDataLayerEvent({ event: "generate_lead", ...data });
  trackMetaEvent("Lead", data);
  try { window.dispatchEvent(new CustomEvent("simpliza:lead_submitted", { detail: data })); } catch {}
}
