import type { BusinessPayload, DatacrazyBusiness, DatacrazyLead, LeadPayload, Paginated } from "./types.ts";
import { hasStringId, isPaginated } from "./types.ts";

export class DatacrazyError extends Error {
  readonly options: { status?: number; retryable: boolean; retryAfterSeconds?: number };

  constructor(message: string, options: { status?: number; retryable: boolean; retryAfterSeconds?: number }) {
    super(message);
    this.name = "DatacrazyError";
    this.options = options;
  }
}

type ClientOptions = {
  apiUrl: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

function retryAfterSeconds(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export class DatacrazyClient {
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor({ apiUrl, token, timeoutMs = 8000, fetchImpl = fetch }: ClientOptions) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  private async request(path: string, init: RequestInit = {}, allowEmpty = false): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      const text = await response.text();
      if (!response.ok) {
        const status = response.status;
        throw new DatacrazyError(`DataCrazy respondeu HTTP ${status}.`, {
          status,
          retryable: status === 408 || status === 429 || status >= 500,
          retryAfterSeconds: status === 429 ? retryAfterSeconds(response.headers.get("retry-after")) : undefined,
        });
      }
      if (!text.trim()) {
        if (allowEmpty) return null;
        throw new DatacrazyError("DataCrazy retornou uma resposta vazia inesperada.", { retryable: true });
      }
      try { return JSON.parse(text); }
      catch { throw new DatacrazyError("DataCrazy retornou JSON inválido.", { retryable: true }); }
    } catch (error) {
      if (error instanceof DatacrazyError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new DatacrazyError("Tempo limite excedido ao chamar o DataCrazy.", { retryable: true });
      }
      throw new DatacrazyError("Falha de rede ao chamar o DataCrazy.", { retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }

  async searchLeads(searchType: "phone" | "email", search: string): Promise<DatacrazyLead[]> {
    const params = new URLSearchParams({ searchType, search, take: "10" });
    const result = await this.request(`/leads?${params}`);
    if (!isPaginated<DatacrazyLead>(result)) throw new DatacrazyError("Resposta inválida ao buscar leads.", { retryable: true });
    return result.data.filter(hasStringId) as DatacrazyLead[];
  }

  async createLead(payload: LeadPayload) {
    return this.request("/leads", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  async createLeadWithAdditionalFields(payload: LeadPayload & { additionalFields: string[] }) {
    return this.request("/leads/additional-fields", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  async updateLead(id: string, payload: LeadPayload): Promise<DatacrazyLead> {
    const result = await this.request(`/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!hasStringId(result)) throw new DatacrazyError("Resposta inválida ao atualizar lead.", { retryable: true });
    return result as DatacrazyLead;
  }

  async createBusiness(payload: BusinessPayload): Promise<DatacrazyBusiness> {
    const result = await this.request("/businesses", { method: "POST", body: JSON.stringify(payload) });
    if (!hasStringId(result)) throw new DatacrazyError("Resposta inválida ao criar negócio.", { retryable: true });
    return result as DatacrazyBusiness;
  }

  async getLeadBusinesses(leadId: string): Promise<DatacrazyBusiness[]> {
    const result = await this.request(`/leads/${encodeURIComponent(leadId)}/businesses?take=100`);
    if (!isPaginated<DatacrazyBusiness>(result)) throw new DatacrazyError("Resposta inválida ao buscar negócios do lead.", { retryable: true });
    return result.data.filter(hasStringId) as DatacrazyBusiness[];
  }

  async getPipelines(): Promise<Paginated<Record<string, unknown>>> {
    const result = await this.request("/pipelines");
    if (!isPaginated<Record<string, unknown>>(result)) throw new DatacrazyError("Resposta inválida ao buscar funis.", { retryable: true });
    return result;
  }

  async getPipelineStages(pipelineId: string): Promise<Paginated<Record<string, unknown>>> {
    const result = await this.request(`/pipelines/${encodeURIComponent(pipelineId)}/stages`);
    if (!isPaginated<Record<string, unknown>>(result)) throw new DatacrazyError("Resposta inválida ao buscar etapas.", { retryable: true });
    return result;
  }

  async getAttendants(): Promise<Paginated<Record<string, unknown>>> {
    const result = await this.request("/attendants/crm");
    if (!isPaginated<Record<string, unknown>>(result)) throw new DatacrazyError("Resposta inválida ao buscar atendentes.", { retryable: true });
    return result;
  }
}
