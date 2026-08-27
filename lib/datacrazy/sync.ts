import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "../supabase.ts";
import { assertDatacrazyReady, getDatacrazyConfig } from "./config.ts";
import { DatacrazyClient, DatacrazyError } from "./client.ts";
import type { DatacrazyAdditionalField, DatacrazyBusiness, DatacrazyLead, DatacrazyTag, LeadPayload } from "./types.ts";
import { hasStringId } from "./types.ts";

export type CrmLeadRecord = {
  id: string;
  name: string;
  phone: string;
  phone_normalized?: string | null;
  email?: string | null;
  establishment: string;
  city?: string | null;
  ambassador_id: string;
  ambassador_name?: string | null;
  ambassador_slug?: string | null;
  campaign_code?: string | null;
  source_page: string;
  source_url?: string | null;
  monthly_revenue?: string | null;
  contact_preference?: string | null;
  consent_lgpd: boolean;
  consent_at?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  crm_external_id: string;
  crm_attempts: number;
  datacrazy_lead_id?: string | null;
  datacrazy_business_id?: string | null;
};

type SyncDependencies = {
  client: DatacrazyClient;
  stageId: string;
  attendantId?: string;
  findRecentBusiness?: (lead: CrmLeadRecord) => Promise<string | null>;
};

const GENERAL_TAG = "LP Embaixadores";
const BUSINESS_FIELD_NAMES = [
  "Faturamento Mensal",
  "Preferência de contato - Embaixadores",
  "Embaixador de origem",
  "URL da LP de origem",
] as const;

type BusinessFieldName = (typeof BUSINESS_FIELD_NAMES)[number];

export function normalizeDatacrazyName(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function normalizeBrazilianPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (!/^\d{10,11}$/.test(digits) || !/^[1-9]{2}/.test(digits)) {
    throw new Error("Telefone brasileiro inválido.");
  }
  return `+55${digits}`;
}

function exactLead(matches: DatacrazyLead[], phone: string, email?: string | null) {
  const digits = phone.replace(/\D/g, "");
  return matches.find((lead) => (lead.rawPhone ?? lead.phone ?? "").replace(/\D/g, "") === digits)
    ?? (email ? matches.find((lead) => lead.email?.toLowerCase() === email.toLowerCase()) : undefined);
}

function ambassadorLabel(lead: CrmLeadRecord) {
  const name = lead.ambassador_name?.trim();
  if (!name) throw new DatacrazyError("Nome público do embaixador ausente no lead.", { retryable: true });
  return lead.ambassador_slug === "felipe" ? "Felipe" : name;
}

function namedId<T extends { id: string; name: string }>(items: T[], expectedName: string, kind: string) {
  const normalized = normalizeDatacrazyName(expectedName);
  const matches = items.filter((item) => normalizeDatacrazyName(item.name) === normalized);
  if (matches.length === 0) {
    throw new DatacrazyError(`${kind} obrigatório não encontrado: ${expectedName}.`, { retryable: true });
  }
  if (matches.length > 1) {
    throw new DatacrazyError(`${kind} obrigatório duplicado: ${expectedName}.`, { retryable: true });
  }
  return matches[0].id;
}

function tagIds(tags: DatacrazyLead["tags"]) {
  const values = Array.isArray(tags) ? tags : tags ? [tags] : [];
  return values.flatMap((tag) => {
    if (typeof tag.id === "string") return [tag.id];
    return Array.isArray(tag.id) ? tag.id.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  });
}

function contactPreferenceLabel(value?: string | null) {
  if (value === "whatsapp") return "WhatsApp";
  if (value === "phone_call") return "Ligação";
  if (value === "email") return "E-mail";
  throw new DatacrazyError("Preferência de contato ausente ou inválida no lead.", { retryable: true });
}

function requiredBusinessValues(lead: CrmLeadRecord, ambassador: string): Record<BusinessFieldName, string> {
  const monthlyRevenue = lead.monthly_revenue?.trim();
  const sourceUrl = lead.source_url?.trim();
  if (!monthlyRevenue) throw new DatacrazyError("Faturamento mensal ausente no lead.", { retryable: true });
  if (!sourceUrl) throw new DatacrazyError("URL da LP de origem ausente no lead.", { retryable: true });
  return {
    "Faturamento Mensal": monthlyRevenue,
    "Preferência de contato - Embaixadores": contactPreferenceLabel(lead.contact_preference),
    "Embaixador de origem": ambassador,
    "URL da LP de origem": sourceUrl,
  };
}

async function resolveRequiredMetadata(client: DatacrazyClient, ambassador: string) {
  const [tags, fields] = await Promise.all([client.getTags(), client.getBusinessAdditionalFields()]);
  const requiredTags = [GENERAL_TAG, `Embaixador - ${ambassador}`].map((name) => namedId<DatacrazyTag>(tags, name, "Tag"));
  const businessFields = Object.fromEntries(
    BUSINESS_FIELD_NAMES.map((name) => [name, namedId<DatacrazyAdditionalField>(fields, name, "Campo adicional")]),
  ) as Record<BusinessFieldName, string>;
  return { requiredTags, businessFields };
}

function leadPayload(
  lead: CrmLeadRecord,
  phone: string,
  ambassador: string,
  requiredTagIds: string[],
  existing?: DatacrazyLead,
): LeadPayload {
  const mergedTagIds = [...new Set([...tagIds(existing?.tags), ...requiredTagIds])];
  return {
    name: lead.name,
    phone,
    ...(lead.email ? { email: lead.email } : {}),
    company: lead.establishment,
    source: `LP Embaixadores / ${ambassador}`,
    ...(lead.city ? { address: { city: lead.city, country: "BR" } } : {}),
    ...(lead.source_url ? { sourceReferral: { sourceUrl: lead.source_url } } : {}),
    tags: [{ id: mergedTagIds }],
  };
}

async function upsertContact(
  lead: CrmLeadRecord,
  deps: SyncDependencies,
  phone: string,
  ambassador: string,
  requiredTagIds: string[],
) {
  let existing: DatacrazyLead | undefined;
  if (lead.datacrazy_lead_id) {
    existing = await deps.client.getLead(lead.datacrazy_lead_id);
  } else {
    const byPhone = await deps.client.searchLeads("phone", phone);
    existing = exactLead(byPhone, phone, lead.email);
    if (!existing && lead.email) {
      const byEmail = await deps.client.searchLeads("email", lead.email);
      existing = exactLead(byEmail, phone, lead.email);
    }
    if (existing) existing = await deps.client.getLead(existing.id);
  }
  const payload = leadPayload(lead, phone, ambassador, requiredTagIds, existing);
  if (existing) return deps.client.updateLead(existing.id, payload);

  const created = await deps.client.createLead(payload);
  if (hasStringId(created)) return created as DatacrazyLead;
  const afterCreate = exactLead(await deps.client.searchLeads("phone", phone), phone, lead.email);
  if (!afterCreate) throw new DatacrazyError("Lead criado, mas o ID ainda não foi retornado pelo DataCrazy.", { retryable: true });
  return afterCreate;
}

async function resolveBusiness(lead: CrmLeadRecord, contactId: string, deps: SyncDependencies, title: string) {
  if (lead.datacrazy_business_id) {
    await deps.client.updateBusiness(lead.datacrazy_business_id, { title });
    return lead.datacrazy_business_id;
  }
  const businesses = await deps.client.getLeadBusinesses(contactId);
  const sameSubmission = businesses.find((item) => item.externalId === lead.crm_external_id);
  if (sameSubmission) {
    await deps.client.updateBusiness(sameSubmission.id, { title });
    return sameSubmission.id;
  }

  const recentId = await deps.findRecentBusiness?.(lead);
  if (recentId) {
    const recentOpen = businesses.find((item) => item.id === recentId && item.status === "in_process");
    if (recentOpen) {
      await deps.client.updateBusiness(recentOpen.id, { title });
      return recentOpen.id;
    }
  }

  const business = await deps.client.createBusiness({
    leadId: contactId,
    stageId: deps.stageId,
    ...(deps.attendantId ? { attendantId: deps.attendantId } : {}),
    externalId: lead.crm_external_id,
    title,
  });
  return business.id;
}

export async function syncLeadRecord(lead: CrmLeadRecord, deps: SyncDependencies) {
  const phone = normalizeBrazilianPhone(lead.phone_normalized || lead.phone);
  const ambassador = ambassadorLabel(lead);
  const businessValues = requiredBusinessValues(lead, ambassador);
  const metadata = await resolveRequiredMetadata(deps.client, ambassador);
  const contact = await upsertContact(lead, deps, phone, ambassador, metadata.requiredTags);
  const title = `${lead.establishment} | ${ambassador}`;
  const businessId = await resolveBusiness(lead, contact.id, deps, title);
  await Promise.all(BUSINESS_FIELD_NAMES.map((name) => (
    deps.client.setBusinessAdditionalField(businessId, metadata.businessFields[name], businessValues[name])
  )));
  return { datacrazyLeadId: contact.id, datacrazyBusinessId: businessId, phone };
}

export function retryDelaySeconds(attempt: number, retryAfter?: number) {
  if (retryAfter !== undefined) return Math.max(1, retryAfter);
  return [60, 300, 1800, 7200, 86400][Math.min(Math.max(attempt - 1, 0), 4)];
}

function sanitizedError(error: unknown) {
  if (error instanceof DatacrazyError) return error.message.slice(0, 500);
  if (error instanceof Error && /DATACRAZY_[A-Z_]+ ausente\./.test(error.message)) return error.message;
  return "Falha inesperada na sincronização com o DataCrazy.";
}

async function findRecentBusiness(client: SupabaseClient, lead: CrmLeadRecord) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await client.from("leads").select("datacrazy_business_id")
    .eq("ambassador_id", lead.ambassador_id)
    .eq("phone_normalized", normalizeBrazilianPhone(lead.phone_normalized || lead.phone))
    .neq("id", lead.id)
    .not("datacrazy_business_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return typeof data?.datacrazy_business_id === "string" ? data.datacrazy_business_id : null;
}

export async function processNextLead(leadId?: string, serviceClient?: SupabaseClient) {
  const config = getDatacrazyConfig();
  if (!config.enabled) return { status: "disabled" as const };

  let ready: ReturnType<typeof assertDatacrazyReady>;
  try { ready = assertDatacrazyReady(config); }
  catch (error) { return { status: "misconfigured" as const, error: sanitizedError(error) }; }

  const db = serviceClient ?? createServiceSupabaseClient();
  if (!db) return { status: "misconfigured" as const, error: "Supabase server-side não configurado." };
  if (ready.manualTestMode) {
    if (!leadId) return { status: "manual-test-waiting" as const };
    const { data: candidate } = await db.from("leads").select("email,phone,phone_normalized").eq("id", leadId).maybeSingle();
    let candidatePhone = "";
    try { candidatePhone = normalizeBrazilianPhone(candidate?.phone_normalized || candidate?.phone || ""); } catch {}
    const allowedPhone = normalizeBrazilianPhone(ready.manualTestPhone!);
    if (candidate?.email?.toLowerCase() !== ready.manualTestEmail || candidatePhone !== allowedPhone) {
      return { status: "manual-test-skipped" as const, leadId };
    }
  }
  const { data, error } = await db.rpc("claim_lead_for_crm", { p_lead_id: leadId ?? null });
  if (error) throw new Error(`Falha ao reservar integração: ${error.message}`);
  const lead = (Array.isArray(data) ? data[0] : null) as CrmLeadRecord | undefined;
  if (!lead) return { status: "empty" as const };

  try {
    const result = await syncLeadRecord(lead, {
      client: new DatacrazyClient(ready),
      stageId: ready.stageId,
      attendantId: ready.attendantId,
      findRecentBusiness: (item) => findRecentBusiness(db, item),
    });
    const { error: updateError } = await db.from("leads").update({
      crm_status: "synced",
      crm_last_error: null,
      crm_next_retry_at: null,
      crm_synced_at: new Date().toISOString(),
      datacrazy_lead_id: result.datacrazyLeadId,
      datacrazy_business_id: result.datacrazyBusinessId,
      phone_normalized: result.phone,
    }).eq("id", lead.id).eq("crm_status", "processing");
    if (updateError) throw new Error(`Falha ao salvar resultado da integração: ${updateError.message}`);
    console.info("[datacrazy] Lead sincronizado.", { leadId: lead.id, attempt: lead.crm_attempts });
    return { status: "synced" as const, leadId: lead.id };
  } catch (error) {
    const retryAfter = error instanceof DatacrazyError ? error.options.retryAfterSeconds : undefined;
    const delay = retryDelaySeconds(lead.crm_attempts, retryAfter);
    const nextRetry = new Date(Date.now() + delay * 1000).toISOString();
    await db.from("leads").update({
      crm_status: "failed",
      crm_last_error: sanitizedError(error),
      crm_next_retry_at: nextRetry,
    }).eq("id", lead.id).eq("crm_status", "processing");
    console.warn("[datacrazy] Sincronização adiada.", { leadId: lead.id, attempt: lead.crm_attempts, nextRetry });
    return { status: "failed" as const, leadId: lead.id, nextRetry };
  }
}

export async function processDueLeads(limit = 10) {
  const results: Awaited<ReturnType<typeof processNextLead>>[] = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await processNextLead();
    results.push(result);
    if (result.status === "empty" || result.status === "disabled" || result.status === "misconfigured") break;
  }
  return results;
}

export function findBusinessByExternalId(items: DatacrazyBusiness[], externalId: string) {
  return items.find((item) => item.externalId === externalId);
}
