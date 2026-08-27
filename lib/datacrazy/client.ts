import type {
  BusinessPayload,
  DatacrazyAdditionalField,
  DatacrazyBusiness,
  DatacrazyLead,
  DatacrazyTag,
  LeadPayload,
  Paginated,
} from "./types.ts";
import { hasStringId, isLeadSearchResult, isObject, isPaginated } from "./types.ts";

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
  crmApiUrl?: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type ResponseResult = {
  body: unknown;
  status: number;
  contentType: string | null;
};

function retryAfterSeconds(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function hasStringIdAndName(value: unknown): value is DatacrazyAdditionalField {
  return isObject(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.name === "string";
}

export class DatacrazyClient {
  private readonly apiUrl: string;
  private readonly crmApiUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor({ apiUrl, crmApiUrl = "https://crm.g1.datacrazy.io", token, timeoutMs = 8000, fetchImpl = fetch }: ClientOptions) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.crmApiUrl = crmApiUrl.replace(/\/$/, "");
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  private async requestWithMetadata(
    path: string,
    init: RequestInit = {},
    allowEmpty = false,
    baseUrl = this.apiUrl,
  ): Promise<ResponseResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${baseUrl}${path}`, {
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
        if (allowEmpty) return { body: null, status: response.status, contentType: response.headers.get("content-type") };
        throw new DatacrazyError("DataCrazy retornou uma resposta vazia inesperada.", { retryable: true });
      }
      try {
        return {
          body: JSON.parse(text),
          status: response.status,
          contentType: response.headers.get("content-type"),
        };
      }
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

  private async request(path: string, init: RequestInit = {}, allowEmpty = false): Promise<unknown> {
    return (await this.requestWithMetadata(path, init, allowEmpty)).body;
  }

  private async requestCrm(path: string, init: RequestInit = {}, allowEmpty = false): Promise<unknown> {
    return (await this.requestWithMetadata(path, init, allowEmpty, this.crmApiUrl)).body;
  }

  async searchLeads(searchType: "phone" | "email", search: string): Promise<DatacrazyLead[]> {
    const params = new URLSearchParams({ searchType, search, take: "10" });
    const response = await this.requestWithMetadata(`/leads?${params}`);
    if (!isLeadSearchResult<DatacrazyLead>(response.body)) {
      const root = isObject(response.body) ? response.body : null;
      const rootKeys = root ? Object.keys(root) : [];
      console.warn("[datacrazy] unexpected_leads_shape", {
        status: response.status,
        contentType: response.contentType,
        rootType: Array.isArray(response.body) ? "array" : isObject(response.body) ? "object" : response.body === null ? "null" : typeof response.body,
        rootKeys,
        countType: root ? typeof root.count : "undefined",
        dataExists: root !== null && Object.hasOwn(root, "data"),
        dataIsArray: root !== null && Array.isArray(root.data),
        arrayKeys: root ? rootKeys.filter((key) => key !== "data" && Array.isArray(root[key])) : [],
        endpoint: "GET /leads",
      });
      throw new DatacrazyError("Resposta inválida ao buscar leads.", { retryable: true });
    }
    return response.body.data.filter(hasStringId) as DatacrazyLead[];
  }

  async createLead(payload: LeadPayload) {
    return this.request("/leads", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  async getLead(id: string): Promise<DatacrazyLead> {
    const result = await this.request(`/leads/${encodeURIComponent(id)}`);
    if (!hasStringId(result)) throw new DatacrazyError("Resposta inválida ao buscar lead por ID.", { retryable: true });
    return result as DatacrazyLead;
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

  async updateBusiness(id: string, payload: { title: string }): Promise<DatacrazyBusiness> {
    const result = await this.request(`/businesses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!hasStringId(result)) throw new DatacrazyError("Resposta inválida ao atualizar negócio.", { retryable: true });
    return result as DatacrazyBusiness;
  }

  async getTags(): Promise<DatacrazyTag[]> {
    const result = await this.request("/tags");
    const values = Array.isArray(result)
      ? result
      : isObject(result) && Array.isArray(result.data)
        ? result.data
        : hasStringId(result)
          ? [result]
          : null;
    if (!values || !values.every(hasStringIdAndName)) {
      throw new DatacrazyError("Resposta inválida ao buscar tags.", { retryable: true });
    }
    return values as DatacrazyTag[];
  }

  async getBusinessAdditionalFields(): Promise<DatacrazyAdditionalField[]> {
    const params = new URLSearchParams({ take: "500", "filter[entity]": "business" });
    const result = await this.requestCrm(`/api/crm/additionalFields?${params}`);
    const values = Array.isArray(result) ? result : isObject(result) && Array.isArray(result.data) ? result.data : null;
    if (!values || !values.every(hasStringIdAndName)) {
      throw new DatacrazyError("Resposta inválida ao buscar campos adicionais de negócio.", { retryable: true });
    }
    return values.filter((item) => !isObject(item) || item.entity === undefined || item.entity === "business") as DatacrazyAdditionalField[];
  }

  async setBusinessAdditionalField(businessId: string, fieldId: string, value: string) {
    await this.requestCrm(
      `/api/crm/additional-fields/business/${encodeURIComponent(businessId)}/${encodeURIComponent(fieldId)}`,
      { method: "POST", body: JSON.stringify({ value }) },
      true,
    );
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
