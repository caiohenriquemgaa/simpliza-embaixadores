import type { CrmLeadRecord } from "./sync.ts";
import { DatacrazyClient, DatacrazyError } from "./client.ts";
import type { DatacrazyAdditionalField } from "./types.ts";

export const INTENT_LABELS = { gestao: "Gestão", operacao: "Operação", delivery: "Delivery", migracao: "Migração" } as const;
export const INSTITUTIONAL_SOURCE = "ChatGPT Ads";
export const INSTITUTIONAL_FORM = "LP Institucional - ChatGPT Ads";

export function institutionalQueueEnabled(sourceName: string) {
  return process.env.VERCEL_ENV !== "preview"
    && process.env.DATACRAZY_INSTITUTIONAL_ENABLED === "true"
    && sourceName === "chatgpt_ads";
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function unique<T extends { id: string; name: string }>(items: T[], name: string): T {
  const matches = items.filter(item => normalized(item.name) === normalized(name));
  if (matches.length !== 1) throw new DatacrazyError(`Metadado institucional ausente ou duplicado: ${name}.`, { retryable: true });
  return matches[0];
}

function accepts(field: DatacrazyAdditionalField, value: string) {
  return field.type === "string" || (field.type === "options" && field.options?.some(option => option.label === value));
}

export async function prepareInstitutionalSync(lead: CrmLeadRecord, client: DatacrazyClient,
  destination: { pipelineId?: string; stageId: string; attendantId?: string }) {
  if (lead.source_name !== "chatgpt_ads" || lead.ambassador_id) {
    throw new DatacrazyError("Identidade institucional inválida.", { retryable: false });
  }
  if (lead.intent && !Object.hasOwn(INTENT_LABELS, lead.intent)) {
    throw new DatacrazyError("Intenção institucional inválida.", { retryable: false });
  }
  if (!destination.pipelineId || !destination.attendantId) {
    throw new DatacrazyError("Funil e responsável comercial institucionais não configurados.", { retryable: true });
  }
  // The existing commercial destination was inspected on 2026-09-24.
  // Never fall back to another pipeline/stage or infer an owner from a name.
  const [pipelines, stages, attendants, tags, fields] = await Promise.all([
    client.getPipelines(), client.getPipelineStages(destination.pipelineId), client.getAttendants(),
    client.getTags(), client.getLeadAdditionalFields(),
  ]);
  const pipeline = pipelines.data.find(item => item.id === destination.pipelineId);
  const stage = stages.data.find(item => item.id === destination.stageId);
  const owner = attendants.data.find(item => item.id === destination.attendantId);
  if (pipeline?.name !== "Simpliza" || stage?.name !== "Lead" || owner?.name !== "Danielle Sanchez") {
    throw new DatacrazyError("Destino comercial não corresponde ao funil, etapa e responsável auditados.", { retryable: true });
  }
  const label = lead.intent ? INTENT_LABELS[lead.intent] : null;
  const requiredTags = [INSTITUTIONAL_SOURCE, ...(label ? [`ChatGPT Ads - ${label}`] : [])]
    .map(name => unique(tags, name).id);
  if (!lead.source_url || !lead.monthly_revenue) {
    throw new DatacrazyError("URL ou faturamento institucional ausente.", { retryable: true });
  }
  const preferences: Record<string, string> = { whatsapp: "WhatsApp", phone_call: "Ligação", email: "E-mail" };
  const preference = preferences[lead.contact_preference ?? ""];
  if (!preference) throw new DatacrazyError("Preferência de contato institucional inválida.", { retryable: true });
  const values: Record<string, string | null | undefined> = {
    "Como Conheceu o Simpliza?": INSTITUTIONAL_SOURCE,
    "Identificação do formulário": INSTITUTIONAL_FORM,
    "URL final": lead.source_url,
    "Faturamento Mensal - formulário do site": lead.monthly_revenue,
    "Como podemos entrar em contato?": preference,
    utm_source: lead.utm_source, utm_campaign: lead.utm_campaign, utm_content: lead.utm_content,
  };
  const mapped = Object.entries(values).map(([name, value]) => {
    const field = unique(fields, name);
    if (value && !accepts(field, value)) throw new DatacrazyError(`Tipo/opções incompatíveis: ${name}.`, { retryable: true });
    return value ? { id: field.id, value } : null;
  }).filter((item): item is { id: string; value: string } => item !== null);
  // Do not write a nonexistent option or create a duplicate origin field.
  const originFields = fields.filter(field => normalized(field.name) === "origem do lead");
  if (originFields.length === 1 && accepts(originFields[0], INSTITUTIONAL_SOURCE)) {
    mapped.push({ id: originFields[0].id, value: INSTITUTIONAL_SOURCE });
  }
  for (const [name, value] of Object.entries({ utm_medium: lead.utm_medium, utm_term: lead.utm_term, intent: lead.intent })) {
    const matches = fields.filter(field => normalized(field.name) === name);
    if (value && matches.length === 1 && accepts(matches[0], value)) mapped.push({ id: matches[0].id, value });
  }
  return {
    requiredTags, fields: mapped,
    marker: `[simpliza:lead:${lead.crm_external_id}]`,
    note: JSON.stringify({
      source_type: "institutional", source_name: "chatgpt_ads", origem: INSTITUTIONAL_SOURCE,
      formulario: INSTITUTIONAL_FORM, intent: lead.intent ?? null, intencao: label ?? "Não informada",
      utm_source: lead.utm_source, utm_medium: lead.utm_medium, utm_campaign: lead.utm_campaign,
      utm_content: lead.utm_content, utm_term: lead.utm_term,
      source_url: lead.source_url, attribution: lead.attribution ?? null,
    }),
  };
}
