import { isUsableEnvValue } from "../env.ts";

const DEFAULT_API_URL = "https://api.g1.datacrazy.io/api/v1";

export type DatacrazyConfig = {
  enabled: boolean;
  apiUrl: string;
  token?: string;
  pipelineId?: string;
  stageId?: string;
  attendantId?: string;
  tagId?: string;
  timeoutMs: number;
  manualTestMode: boolean;
  manualTestEmail?: string;
  manualTestPhone?: string;
  customFields: Record<string, string>;
};

function optional(name: string) {
  const value = process.env[name];
  return isUsableEnvValue(value) ? value : undefined;
}

export function getDatacrazyConfig(): DatacrazyConfig {
  const rawUrl = optional("DATACRAZY_API_URL") ?? DEFAULT_API_URL;
  let apiUrl = DEFAULT_API_URL;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") apiUrl = parsed.href.replace(/\/$/, "");
  } catch {}

  const timeout = Number(process.env.DATACRAZY_TIMEOUT_MS ?? 8000);
  return {
    enabled: process.env.DATACRAZY_INTEGRATION_ENABLED === "true",
    apiUrl,
    token: optional("DATACRAZY_API_TOKEN"),
    pipelineId: optional("DATACRAZY_PIPELINE_ID"),
    stageId: optional("DATACRAZY_STAGE_ID"),
    attendantId: optional("DATACRAZY_ATTENDANT_ID"),
    tagId: optional("DATACRAZY_TAG_LP_EMBAIXADORES_ID"),
    timeoutMs: Number.isFinite(timeout) && timeout >= 1000 && timeout <= 30000 ? timeout : 8000,
    manualTestMode: process.env.DATACRAZY_MANUAL_TEST_MODE === "true",
    manualTestEmail: optional("DATACRAZY_MANUAL_TEST_EMAIL")?.toLowerCase(),
    manualTestPhone: optional("DATACRAZY_MANUAL_TEST_PHONE"),
    customFields: {
      sourceMain: optional("DATACRAZY_FIELD_SOURCE_MAIN_ID") ?? "",
      ambassadorName: optional("DATACRAZY_FIELD_AMBASSADOR_NAME_ID") ?? "",
      ambassadorId: optional("DATACRAZY_FIELD_AMBASSADOR_ID") ?? "",
      ambassadorSlug: optional("DATACRAZY_FIELD_AMBASSADOR_SLUG_ID") ?? "",
      campaignCode: optional("DATACRAZY_FIELD_CAMPAIGN_CODE_ID") ?? "",
      sourcePage: optional("DATACRAZY_FIELD_SOURCE_PAGE_ID") ?? "",
      sourceUrl: optional("DATACRAZY_FIELD_SOURCE_URL_ID") ?? "",
      monthlyRevenue: optional("DATACRAZY_FIELD_MONTHLY_REVENUE_ID") ?? "",
      contactPreference: optional("DATACRAZY_FIELD_CONTACT_PREFERENCE_ID") ?? "",
      utmSource: optional("DATACRAZY_FIELD_UTM_SOURCE_ID") ?? "",
      utmMedium: optional("DATACRAZY_FIELD_UTM_MEDIUM_ID") ?? "",
      utmCampaign: optional("DATACRAZY_FIELD_UTM_CAMPAIGN_ID") ?? "",
      utmContent: optional("DATACRAZY_FIELD_UTM_CONTENT_ID") ?? "",
      utmTerm: optional("DATACRAZY_FIELD_UTM_TERM_ID") ?? "",
      externalId: optional("DATACRAZY_FIELD_EXTERNAL_ID") ?? "",
      establishment: optional("DATACRAZY_FIELD_ESTABLISHMENT_ID") ?? "",
      city: optional("DATACRAZY_FIELD_CITY_ID") ?? "",
      consent: optional("DATACRAZY_FIELD_CONSENT_ID") ?? "",
      consentAt: optional("DATACRAZY_FIELD_CONSENT_AT_ID") ?? "",
    },
  };
}

export function assertDatacrazyReady(config = getDatacrazyConfig()) {
  if (!config.token) throw new Error("DATACRAZY_API_TOKEN ausente.");
  if (!config.stageId) throw new Error("DATACRAZY_STAGE_ID ausente.");
  if (config.manualTestMode && (!config.manualTestEmail || !config.manualTestPhone)) {
    throw new Error("Credenciais do modo de teste manual ausentes.");
  }
  return config as DatacrazyConfig & { token: string; stageId: string };
}
