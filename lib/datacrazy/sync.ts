import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "../supabase.ts";
import { assertDatacrazyReady, getDatacrazyConfig } from "./config.ts";
import { DatacrazyClient, DatacrazyError } from "./client.ts";
import type { DatacrazyBusiness, DatacrazyLead, LeadPayload } from "./types.ts";
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
  tagId?: string;
  stageId: string;
  attendantId?: string;
  findRecentBusiness?: (lead: CrmLeadRecord) => Promise<string | null>;
};

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

function leadPayload(lead: CrmLeadRecord, phone: string, tagId?: string): LeadPayload {
  return {
    name: lead.name,
    phone,
    ...(lead.email ? { email: lead.email } : {}),
    company: lead.establishment,
    source: "Programa de Embaixadores",
    ...(lead.city ? { address: { city: lead.city, country: "BR" } } : {}),
    ...(lead.source_url ? { sourceReferral: { sourceUrl: lead.source_url } } : {}),
    ...(tagId ? { tags: [{ id: [tagId] }] } : {}),
  };
}

async function upsertContact(lead: CrmLeadRecord, deps: SyncDependencies, phone: string) {
  const payload = leadPayload(lead, phone, deps.tagId);
  if (lead.datacrazy_lead_id) return deps.client.updateLead(lead.datacrazy_lead_id, payload);

  const byPhone = await deps.client.searchLeads("phone", phone);
  let existing = exactLead(byPhone, phone, lead.email);
  if (!existing && lead.email) {
    const byEmail = await deps.client.searchLeads("email", lead.email);
    existing = exactLead(byEmail, phone, lead.email);
  }
  if (existing) return deps.client.updateLead(existing.id, payload);

  const created = await deps.client.createLead(payload);
  if (hasStringId(created)) return created as DatacrazyLead;
  const afterCreate = exactLead(await deps.client.searchLeads("phone", phone), phone, lead.email);
  if (!afterCreate) throw new DatacrazyError("Lead criado, mas o ID ainda não foi retornado pelo DataCrazy.", { retryable: true });
  return afterCreate;
}

async function resolveBusiness(lead: CrmLeadRecord, contactId: string, deps: SyncDependencies) {
  if (lead.datacrazy_business_id) return lead.datacrazy_business_id;
  const businesses = await deps.client.getLeadBusinesses(contactId);
  const sameSubmission = businesses.find((item) => item.externalId === lead.crm_external_id);
  if (sameSubmission) return sameSubmission.id;

  const recentId = await deps.findRecentBusiness?.(lead);
  if (recentId) {
    const recentOpen = businesses.find((item) => item.id === recentId && item.status === "in_process");
    if (recentOpen) return recentOpen.id;
  }

  const business = await deps.client.createBusiness({
    leadId: contactId,
    stageId: deps.stageId,
    ...(deps.attendantId ? { attendantId: deps.attendantId } : {}),
    externalId: lead.crm_external_id,
  });
  return business.id;
}

export async function syncLeadRecord(lead: CrmLeadRecord, deps: SyncDependencies) {
  const phone = normalizeBrazilianPhone(lead.phone_normalized || lead.phone);
  const contact = await upsertContact(lead, deps, phone);
  const businessId = await resolveBusiness(lead, contact.id, deps);
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
      tagId: ready.tagId,
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
