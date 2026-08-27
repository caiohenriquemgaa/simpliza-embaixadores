import assert from "node:assert/strict";
import test from "node:test";
import { DatacrazyClient, DatacrazyError } from "../lib/datacrazy/client.ts";
import { assertDatacrazyReady } from "../lib/datacrazy/config.ts";
import {
  normalizeBrazilianPhone,
  normalizeDatacrazyName,
  retryDelaySeconds,
  syncLeadRecord,
} from "../lib/datacrazy/sync.ts";
import { isLeadSearchResult, isPaginated } from "../lib/datacrazy/types.ts";

const baseLead = {
  id: "4e4a6bd1-c4a9-4e9d-bb8f-08144f87aa10",
  name: "Lead de Teste", phone: "(11) 99999-9999", phone_normalized: "+5511999999999",
  email: "lead@example.com", establishment: "Restaurante Teste", city: "São Paulo",
  ambassador_id: "a379a73d-4ea3-49b7-b6e6-57366498bb51", ambassador_name: "Embaixador Teste",
  ambassador_slug: "embaixador-teste", campaign_code: "campanha-teste", source_page: "/embaixadores/embaixador-teste",
  source_url: "https://example.com/embaixadores/embaixador-teste?utm_source=teste", monthly_revenue: "Até R$ 30 mil",
  contact_preference: "whatsapp", consent_lgpd: true, consent_at: "2026-08-25T12:00:00.000Z",
  utm_source: "teste", utm_medium: "social", utm_campaign: "embaixadores", utm_content: "bio", utm_term: "restaurante",
  crm_external_id: "4e4a6bd1-c4a9-4e9d-bb8f-08144f87aa10", crm_attempts: 1,
};

const tags = [
  { id: "tag-general", name: "LP Embaixadores" },
  { id: "tag-test", name: "Embaixador - Embaixador Teste" },
  { id: "tag-felipe", name: "Embaixador - Felipe" },
  { id: "tag-ana", name: "Embaixador - Ana" },
];

const fields = [
  { id: "field-revenue", name: "faturamento mensal", entity: "business" },
  { id: "field-preference", name: "PREFERENCIA DE CONTATO - EMBAIXADORES", entity: "business" },
  { id: "field-ambassador", name: "  Embaixador   de origem ", entity: "business" },
  { id: "field-url", name: "URL da LP de origem", entity: "business" },
];

function client(overrides = {}) {
  return {
    async getTags() { return tags; },
    async getBusinessAdditionalFields() { return fields; },
    async searchLeads() { return []; },
    async getLead(id) { return { id }; },
    async createLead() { return { id: "dc-lead-1" }; },
    async updateLead(id) { return { id }; },
    async getLeadBusinesses() { return []; },
    async createBusiness() { return { id: "dc-business-1" }; },
    async updateBusiness(id) { return { id }; },
    async setBusinessAdditionalField() {},
    ...overrides,
  };
}

test("normalizes Brazilian phones with and without country code", () => {
  assert.equal(normalizeBrazilianPhone("(11) 99999-9999"), "+5511999999999");
  assert.equal(normalizeBrazilianPhone("11999999999"), "+5511999999999");
  assert.equal(normalizeBrazilianPhone("+55 (11) 3333-4444"), "+551133334444");
  assert.throws(() => normalizeBrazilianPhone("123"), /inválido/);
});

test("creates a complete contact and business with two tags and four additional fields", async () => {
  const calls = [];
  const fake = client({
    async searchLeads(type) { calls.push(["search", type]); return []; },
    async createLead(payload) { calls.push(["createLead", payload]); return { id: "dc-lead-1" }; },
    async createBusiness(payload) { calls.push(["createBusiness", payload]); return { id: "dc-business-1" }; },
    async setBusinessAdditionalField(businessId, fieldId, value) {
      calls.push(["setField", businessId, fieldId, value]);
    },
  });
  const result = await syncLeadRecord(baseLead, { client: fake, stageId: "stage-1", attendantId: "attendant-1" });
  assert.deepEqual(result, { datacrazyLeadId: "dc-lead-1", datacrazyBusinessId: "dc-business-1", phone: "+5511999999999" });
  const leadPayload = calls.find(([name]) => name === "createLead")[1];
  assert.equal(leadPayload.name, baseLead.name);
  assert.equal(leadPayload.phone, "+5511999999999");
  assert.equal(leadPayload.email, baseLead.email);
  assert.equal(leadPayload.company, baseLead.establishment);
  assert.equal(leadPayload.source, "LP Embaixadores / Embaixador Teste");
  assert.equal(leadPayload.sourceReferral.sourceUrl, baseLead.source_url);
  assert.deepEqual(leadPayload.tags, [{ id: ["tag-general", "tag-test"] }]);
  const businessPayload = calls.find(([name]) => name === "createBusiness")[1];
  assert.deepEqual(businessPayload, {
    leadId: "dc-lead-1", stageId: "stage-1", attendantId: "attendant-1",
    externalId: baseLead.crm_external_id, title: "Restaurante Teste | Embaixador Teste",
  });
  assert.deepEqual(calls.filter(([name]) => name === "setField").map(([, , fieldId, value]) => [fieldId, value]), [
    ["field-revenue", "Até R$ 30 mil"],
    ["field-preference", "WhatsApp"],
    ["field-ambassador", "Embaixador Teste"],
    ["field-url", baseLead.source_url],
  ]);
});

test("updates an existing contact, preserves its tags and does not duplicate the business", async () => {
  let createdContacts = 0;
  let createdBusinesses = 0;
  let updatedPayload;
  let updatedBusiness;
  const fake = client({
    async searchLeads(type) {
      assert.equal(type, "phone");
      return [{ id: "dc-lead-1", rawPhone: "5511999999999", tags: [{ id: "old-tag", name: "Cliente" }] }];
    },
    async getLead(id) { return { id, rawPhone: "5511999999999", tags: [{ id: "old-tag", name: "Cliente" }] }; },
    async createLead() { createdContacts += 1; return { id: "duplicate" }; },
    async updateLead(id, payload) { assert.equal(id, "dc-lead-1"); updatedPayload = payload; return { id }; },
    async getLeadBusinesses() {
      return [{ id: "dc-business-1", externalId: baseLead.crm_external_id, status: "in_process" }];
    },
    async createBusiness() { createdBusinesses += 1; return { id: "duplicate" }; },
    async updateBusiness(id, payload) { updatedBusiness = [id, payload]; return { id }; },
  });
  const result = await syncLeadRecord(baseLead, { client: fake, stageId: "stage-1" });
  assert.equal(result.datacrazyBusinessId, "dc-business-1");
  assert.equal(createdContacts, 0);
  assert.equal(createdBusinesses, 0);
  assert.deepEqual(updatedPayload.tags, [{ id: ["old-tag", "tag-general", "tag-test"] }]);
  assert.deepEqual(updatedBusiness, ["dc-business-1", { title: "Restaurante Teste | Embaixador Teste" }]);
});

test("falls back to email when no phone match exists", async () => {
  const searches = [];
  const fake = client({
    async searchLeads(type) {
      searches.push(type);
      return type === "email" ? [{ id: "dc-email-lead", email: baseLead.email }] : [];
    },
    async createLead() { throw new Error("unexpected create"); },
    async updateLead(id) { assert.equal(id, "dc-email-lead"); return { id }; },
  });
  const result = await syncLeadRecord(baseLead, { client: fake, stageId: "stage-1" });
  assert.deepEqual(searches, ["phone", "email"]);
  assert.equal(result.datacrazyLeadId, "dc-email-lead");
});

test("reprocessing stored IDs updates in place and never creates another business", async () => {
  let businessUpdates = 0;
  const fake = client({
    async getLead(id) { return { id, tags: { id: "old-tag" } }; },
    async searchLeads() { throw new Error("unexpected search"); },
    async getLeadBusinesses() { throw new Error("unexpected business lookup"); },
    async createBusiness() { throw new Error("unexpected business create"); },
    async updateBusiness(id) { assert.equal(id, "stored-business"); businessUpdates += 1; return { id }; },
  });
  const result = await syncLeadRecord({
    ...baseLead, datacrazy_lead_id: "dc-lead-1", datacrazy_business_id: "stored-business",
  }, { client: fake, stageId: "stage-1" });
  assert.equal(result.datacrazyBusinessId, "stored-business");
  assert.equal(businessUpdates, 1);
});

test("missing required tag is recoverable and stops before contact or business creation", async () => {
  let mutations = 0;
  const fake = client({
    async getTags() { return tags.filter((tag) => tag.id !== "tag-test"); },
    async searchLeads() { mutations += 1; return []; },
    async createLead() { mutations += 1; return { id: "unexpected" }; },
    async createBusiness() { mutations += 1; return { id: "unexpected" }; },
  });
  await assert.rejects(() => syncLeadRecord(baseLead, { client: fake, stageId: "stage-1" }), (error) => {
    assert.ok(error instanceof DatacrazyError);
    assert.equal(error.options.retryable, true);
    assert.match(error.message, /Tag obrigatório não encontrado/);
    return true;
  });
  assert.equal(mutations, 0);
});

test("missing required business field is recoverable and stops before an incomplete business", async () => {
  let mutations = 0;
  const fake = client({
    async getBusinessAdditionalFields() { return fields.filter((field) => field.id !== "field-url"); },
    async searchLeads() { mutations += 1; return []; },
    async createBusiness() { mutations += 1; return { id: "unexpected" }; },
  });
  await assert.rejects(() => syncLeadRecord(baseLead, { client: fake, stageId: "stage-1" }), (error) => {
    assert.ok(error instanceof DatacrazyError);
    assert.equal(error.options.retryable, true);
    assert.match(error.message, /Campo adicional obrigatório não encontrado/);
    return true;
  });
  assert.equal(mutations, 0);
});

test("CRM metadata route failure is recoverable and creates no partial business", async () => {
  let mutations = 0;
  const fake = client({
    async getBusinessAdditionalFields() {
      throw new DatacrazyError("DataCrazy respondeu HTTP 503.", { status: 503, retryable: true });
    },
    async searchLeads() { mutations += 1; return []; },
    async createLead() { mutations += 1; return { id: "unexpected" }; },
    async createBusiness() { mutations += 1; return { id: "unexpected" }; },
  });
  await assert.rejects(() => syncLeadRecord(baseLead, { client: fake, stageId: "stage-1" }), (error) => {
    assert.ok(error instanceof DatacrazyError);
    assert.equal(error.options.retryable, true);
    assert.equal(error.options.status, 503);
    return true;
  });
  assert.equal(mutations, 0);
});

test("Felipe and another ambassador receive different dynamically resolved tags", async () => {
  const payloads = [];
  const fake = client({
    async createLead(payload) { payloads.push(payload); return { id: `lead-${payloads.length}` }; },
  });
  await syncLeadRecord({ ...baseLead, ambassador_name: "Felipe da Silva", ambassador_slug: "felipe" }, { client: fake, stageId: "stage" });
  await syncLeadRecord({ ...baseLead, id: "lead-ana", crm_external_id: "lead-ana", ambassador_name: "Ana", ambassador_slug: "ana" }, { client: fake, stageId: "stage" });
  assert.deepEqual(payloads[0].tags, [{ id: ["tag-general", "tag-felipe"] }]);
  assert.deepEqual(payloads[1].tags, [{ id: ["tag-general", "tag-ana"] }]);
  assert.equal(payloads[0].source, "LP Embaixadores / Felipe");
  assert.equal(payloads[1].source, "LP Embaixadores / Ana");
});

test("normalizes case, accents and whitespace only for metadata name matching", () => {
  assert.equal(normalizeDatacrazyName("  Preferência   DE Contato  "), "preferencia de contato");
});

test("uses the CRM base for business field definitions and values", async () => {
  const requests = [];
  const apiClient = new DatacrazyClient({
    apiUrl: "https://api.example.test/api/v1",
    crmApiUrl: "https://crm.example.test",
    token: "secret",
    fetchImpl: async (url, init) => {
      requests.push([String(url), init.method ?? "GET", init.body]);
      if (String(url).endsWith("/tags")) return Response.json({ data: tags });
      if (String(url).includes("additionalFields?")) return Response.json({ count: fields.length, data: fields });
      return new Response(null, { status: 204 });
    },
  });
  assert.deepEqual(await apiClient.getTags(), tags);
  assert.deepEqual(await apiClient.getBusinessAdditionalFields(), fields);
  await apiClient.setBusinessAdditionalField("business 1", "field/1", "valor");
  assert.match(requests[1][0], /^https:\/\/crm\.example\.test\/api\/crm\/additionalFields\?/);
  assert.match(requests[1][0], /filter%5Bentity%5D=business/);
  assert.equal(requests[2][0], "https://crm.example.test/api/crm/additional-fields/business/business%201/field%2F1");
  assert.equal(requests[2][1], "POST");
  assert.equal(requests[2][2], JSON.stringify({ value: "valor" }));
});

test("uses documented lead search parameters", async () => {
  let requestedUrl = "";
  const apiClient = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "secret", fetchImpl: async (url, init) => {
    requestedUrl = String(url);
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer secret");
    return Response.json({ count: 0, data: [] });
  } });
  await apiClient.searchLeads("phone", "+5511999999999");
  assert.match(requestedUrl, /searchType=phone/);
  assert.match(requestedUrl, /search=%2B5511999999999/);
});

test("accepts lead search responses with optional count and rejects malformed roots", () => {
  const lead = { id: "dc-lead-1" };
  const cases = [
    [{ count: 1, data: [lead] }, true], [{ data: [lead] }, true], [{ data: [] }, true],
    [{ count: 1 }, false], [{ data: {} }, false], [[lead], false], [null, false],
  ];
  for (const [value, expected] of cases) assert.equal(isLeadSearchResult(value), expected);
  assert.equal(isPaginated({ data: [lead] }), false);
});

test("searches leads when DataCrazy omits count", async () => {
  const lead = { id: "dc-lead-1", rawPhone: "5511999999999" };
  const apiClient = new DatacrazyClient({
    apiUrl: "https://api.example.test/api/v1", token: "secret",
    fetchImpl: async () => Response.json({ data: [lead] }),
  });
  assert.deepEqual(await apiClient.searchLeads("phone", "+5511999999999"), [lead]);
});

test("logs only sanitized metadata for an unexpected leads response", async () => {
  const phone = "+5511998765432";
  const email = "private@example.test";
  const token = "super-secret-token";
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const apiClient = new DatacrazyClient({
      apiUrl: "https://api.example.test/api/v1", token,
      fetchImpl: async () => Response.json({
        items: [{ phone, email, authorization: `Bearer ${token}` }], total: 1,
      }, { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }),
    });
    await assert.rejects(() => apiClient.searchLeads("phone", phone), /Resposta inválida ao buscar leads/);
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(warnings, [["[datacrazy] unexpected_leads_shape", {
    status: 200, contentType: "application/json; charset=utf-8", rootType: "object",
    rootKeys: ["items", "total"], countType: "undefined", dataExists: false,
    dataIsArray: false, arrayKeys: ["items"], endpoint: "GET /leads",
  }]]);
  const serializedLog = JSON.stringify(warnings);
  assert.doesNotMatch(serializedLog, new RegExp(phone.replace("+", "\\+")));
  assert.doesNotMatch(serializedLog, new RegExp(email));
  assert.doesNotMatch(serializedLog, new RegExp(token));
  assert.doesNotMatch(serializedLog, /authorization|bearer|search=/i);
});

test("surfaces 429 and respects Retry-After", async () => {
  const apiClient = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "secret", fetchImpl: async () => new Response('{"message":"Too many requests"}', { status: 429, headers: { "Retry-After": "30" } }) });
  await assert.rejects(() => apiClient.searchLeads("phone", "+5511999999999"), (error) => {
    assert.ok(error instanceof DatacrazyError);
    assert.equal(error.options.status, 429);
    assert.equal(error.options.retryAfterSeconds, 30);
    return true;
  });
});

test("aborts a request after the configured timeout", async () => {
  const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  const apiClient = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "secret", timeoutMs: 5, fetchImpl });
  await assert.rejects(() => apiClient.searchLeads("phone", "+5511999999999"), /Tempo limite/);
});

test("marks network failures as temporary without leaking the token", async () => {
  const apiClient = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "super-secret-token", fetchImpl: async () => { throw new Error("socket closed"); } });
  await assert.rejects(() => apiClient.searchLeads("phone", "+5511999999999"), (error) => {
    assert.ok(error instanceof DatacrazyError);
    assert.equal(error.options.retryable, true);
    assert.doesNotMatch(error.message, /super-secret-token/);
    return true;
  });
});

test("uses progressive retry delays and lets Retry-After win", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((attempt) => retryDelaySeconds(attempt)), [60, 300, 1800, 7200, 86400]);
  assert.equal(retryDelaySeconds(1, 42), 42);
});

test("requires token and stage before activation", () => {
  const base = {
    enabled: true, apiUrl: "https://api.example.test/api/v1", crmApiUrl: "https://crm.example.test",
    timeoutMs: 8000, manualTestMode: false,
  };
  assert.throws(() => assertDatacrazyReady({ ...base, stageId: "stage" }), /TOKEN ausente/);
  assert.throws(() => assertDatacrazyReady({ ...base, token: "secret" }), /STAGE_ID ausente/);
});
