import type { Attribution } from "../attribution.ts";
// Prepared mapping only. Institutional submissions are held with crm_status=ignored
// until the destination pipeline, tags and additional-field IDs are configured.
export function institutionalCrmContext(sourceName: string, attribution: Attribution) {
  const labels = { gestao: "Gestão", operacao: "Operação", delivery: "Delivery", migracao: "Migração" };
  const intent = attribution.intent;
  return {
    source: sourceName === "chatgpt_ads" ? `ChatGPT Ads${intent ? ` — ${labels[intent]}` : ""}` : `Institucional — ${sourceName}`,
    source_type: "institutional",
    source_name: sourceName,
    intent,
    first_touch: attribution.firstTouch,
    conversion_touch: attribution.conversionTouch,
  };
}
