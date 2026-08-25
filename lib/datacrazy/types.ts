export type DatacrazyLead = {
  id: string;
  name?: string;
  phone?: string;
  rawPhone?: string;
  email?: string;
};

export type DatacrazyBusiness = {
  id: string;
  leadId?: string;
  stageId?: string;
  attendantId?: string;
  externalId?: string;
  status?: "in_process" | "won" | "lost" | string;
  createdAt?: string;
};

export type LeadPayload = {
  name: string;
  phone: string;
  email?: string;
  company: string;
  source: "Programa de Embaixadores";
  address?: { city: string; country: "BR" };
  sourceReferral?: { sourceUrl: string };
  tags?: Array<{ id: string[] }>;
};

export type BusinessPayload = {
  leadId: string;
  stageId: string;
  attendantId?: string;
  externalId: string;
};

export type Paginated<T> = { count: number; data: T[] };

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasStringId(value: unknown): value is { id: string } {
  return isObject(value) && typeof value.id === "string" && value.id.length > 0;
}

export function isPaginated<T>(value: unknown): value is Paginated<T> {
  return isObject(value) && typeof value.count === "number" && Array.isArray(value.data);
}
