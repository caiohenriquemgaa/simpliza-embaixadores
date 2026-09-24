import type { Attribution } from "../attribution.ts";
// Context is persisted before CRM sync. The institutional channel has its own activation flag.
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
