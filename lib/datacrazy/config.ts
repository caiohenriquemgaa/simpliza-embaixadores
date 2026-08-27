import { isUsableEnvValue } from "../env.ts";

const DEFAULT_API_URL = "https://api.g1.datacrazy.io/api/v1";
const DEFAULT_CRM_API_URL = "https://crm.g1.datacrazy.io";

export type DatacrazyConfig = {
  enabled: boolean;
  apiUrl: string;
  crmApiUrl: string;
  token?: string;
  pipelineId?: string;
  stageId?: string;
  attendantId?: string;
  timeoutMs: number;
  manualTestMode: boolean;
  manualTestEmail?: string;
  manualTestPhone?: string;
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

  const rawCrmUrl = optional("DATACRAZY_CRM_API_URL") ?? DEFAULT_CRM_API_URL;
  let crmApiUrl = DEFAULT_CRM_API_URL;
  try {
    const parsed = new URL(rawCrmUrl);
    if (parsed.protocol === "https:") crmApiUrl = parsed.href.replace(/\/$/, "");
  } catch {}

  const timeout = Number(process.env.DATACRAZY_TIMEOUT_MS ?? 8000);
  return {
    enabled: process.env.DATACRAZY_INTEGRATION_ENABLED === "true",
    apiUrl,
    crmApiUrl,
    token: optional("DATACRAZY_API_TOKEN"),
    pipelineId: optional("DATACRAZY_PIPELINE_ID"),
    stageId: optional("DATACRAZY_STAGE_ID"),
    attendantId: optional("DATACRAZY_ATTENDANT_ID"),
    timeoutMs: Number.isFinite(timeout) && timeout >= 1000 && timeout <= 30000 ? timeout : 8000,
    manualTestMode: process.env.DATACRAZY_MANUAL_TEST_MODE === "true",
    manualTestEmail: optional("DATACRAZY_MANUAL_TEST_EMAIL")?.toLowerCase(),
    manualTestPhone: optional("DATACRAZY_MANUAL_TEST_PHONE"),
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
