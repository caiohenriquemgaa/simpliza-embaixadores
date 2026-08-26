import assert from "node:assert/strict";
import test from "node:test";
import { DatacrazyClient, DatacrazyError } from "../lib/datacrazy/client.ts";
import { assertDatacrazyReady } from "../lib/datacrazy/config.ts";
import { normalizeBrazilianPhone, retryDelaySeconds, syncLeadRecord } from "../lib/datacrazy/sync.ts";
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

test("normalizes Brazilian phones with country code", () => {
  assert.equal(normalizeBrazilianPhone("(11) 99999-9999"), "+5511999999999");
  assert.equal(normalizeBrazilianPhone("+55 (11) 3333-4444"), "+551133334444");
  assert.throws(() => normalizeBrazilianPhone("123"), /inválido/);
});

test("creates a new lead and business with the local UUID as externalId", async () => {
  const calls = [];
  const client = {
    async searchLeads(type) { calls.push(["search", type]); return []; },
    async createLead(payload) { calls.push(["createLead", payload]); return { id: "dc-lead-1" }; },
    async updateLead() { throw new Error("unexpected update"); },
    async getLeadBusinesses() { calls.push(["businesses"]); return []; },
    async createBusiness(payload) { calls.push(["createBusiness", payload]); return { id: "dc-business-1" }; },
  };
  const result = await syncLeadRecord(baseLead, { client, stageId: "stage-1", attendantId: "attendant-1", tagId: "tag-1" });
  assert.deepEqual(result, { datacrazyLeadId: "dc-lead-1", datacrazyBusinessId: "dc-business-1", phone: "+5511999999999" });
  const leadPayload = calls.find(([name]) => name === "createLead")[1];
  assert.equal(leadPayload.source, "Programa de Embaixadores");
  assert.equal(leadPayload.sourceReferral.sourceUrl, baseLead.source_url);
  assert.deepEqual(leadPayload.tags, [{ id: ["tag-1"] }]);
  const businessPayload = calls.find(([name]) => name === "createBusiness")[1];
  assert.equal(businessPayload.externalId, baseLead.id);
});

test("updates an existing phone match and does not duplicate its business", async () => {
  let createdBusinesses = 0;
  const client = {
    async searchLeads(type) { assert.equal(type, "phone"); return [{ id: "dc-lead-1", rawPhone: "5511999999999" }]; },
    async createLead() { throw new Error("unexpected create"); },
    async updateLead(id) { assert.equal(id, "dc-lead-1"); return { id }; },
    async getLeadBusinesses() { return [{ id: "dc-business-1", externalId: baseLead.crm_external_id, status: "in_process" }]; },
    async createBusiness() { createdBusinesses += 1; return { id: "duplicate" }; },
  };
  const result = await syncLeadRecord(baseLead, { client, stageId: "stage-1" });
  assert.equal(result.datacrazyBusinessId, "dc-business-1");
  assert.equal(createdBusinesses, 0);
});

test("falls back to email when no phone match exists", async () => {
  const searches = [];
  const client = {
    async searchLeads(type) { searches.push(type); return type === "email" ? [{ id: "dc-email-lead", email: baseLead.email }] : []; },
    async createLead() { throw new Error("unexpected create"); },
    async updateLead(id) { assert.equal(id, "dc-email-lead"); return { id }; },
    async getLeadBusinesses() { return []; },
    async createBusiness() { return { id: "dc-business-email" }; },
  };
  const result = await syncLeadRecord(baseLead, { client, stageId: "stage-1" });
  assert.deepEqual(searches, ["phone", "email"]);
  assert.equal(result.datacrazyLeadId, "dc-email-lead");
});

test("reuses a recent open business for the same contact and ambassador", async () => {
  const client = {
    async searchLeads() { return [{ id: "dc-lead-1", rawPhone: "5511999999999" }]; },
    async updateLead(id) { return { id }; },
    async getLeadBusinesses() { return [{ id: "recent-business", status: "in_process" }]; },
    async createBusiness() { throw new Error("unexpected create"); },
  };
  const result = await syncLeadRecord(baseLead, { client, stageId: "stage-1", findRecentBusiness: async (lead) => {
    assert.equal(lead.ambassador_id, baseLead.ambassador_id); return "recent-business";
  } });
  assert.equal(result.datacrazyBusinessId, "recent-business");
});

test("keeps an already stored business id without creating another", async () => {
  const client = {
    async updateLead(id) { return { id }; },
    async getLeadBusinesses() { throw new Error("unexpected lookup"); },
    async createBusiness() { throw new Error("unexpected create"); },
  };
  const result = await syncLeadRecord({ ...baseLead, datacrazy_lead_id: "dc-lead-1", datacrazy_business_id: "stored-business" }, { client, stageId: "stage-1" });
  assert.equal(result.datacrazyBusinessId, "stored-business");
});

test("uses documented lead search parameters", async () => {
  let requestedUrl = "";
  const client = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "secret", fetchImpl: async (url, init) => {
    requestedUrl = String(url);
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer secret");
    return Response.json({ count: 0, data: [] });
  } });
  await client.searchLeads("phone", "+5511999999999");
  assert.match(requestedUrl, /searchType=phone/);
  assert.match(requestedUrl, /search=%2B5511999999999/);
});

test("accepts lead search responses with optional count and rejects malformed roots", () => {
  const lead = { id: "dc-lead-1" };
  const cases = [
    [{ count: 1, data: [lead] }, true],
    [{ data: [lead] }, true],
    [{ data: [] }, true],
    [{ count: 1 }, false],
    [{ data: {} }, false],
    [[lead], false],
    [null, false],
  ];

  for (const [value, expected] of cases) {
    assert.equal(isLeadSearchResult(value), expected);
  }
  assert.equal(isPaginated({ data: [lead] }), false);
});

test("searches leads when Data Crazy omits count", async () => {
  const lead = { id: "dc-lead-1", rawPhone: "5511999999999" };
  const client = new DatacrazyClient({
    apiUrl: "https://api.example.test/api/v1",
    token: "secret",
    fetchImpl: async () => Response.json({ data: [lead] }),
  });

  assert.deepEqual(await client.searchLeads("phone", "+5511999999999"), [lead]);
});

test("logs only sanitized metadata for an unexpected leads response", async () => {
  const phone = "+5511998765432";
  const email = "private@example.test";
  const token = "super-secret-token";
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  try {
    const client = new DatacrazyClient({
      apiUrl: "https://api.example.test/api/v1",
      token,
      fetchImpl: async () => Response.json({
        items: [{ phone, email, authorization: `Bearer ${token}` }],
        total: 1,
      }, { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }),
    });

    await assert.rejects(() => client.searchLeads("phone", phone), /Resposta inválida ao buscar leads/);
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, [["[datacrazy] unexpected_leads_shape", {
    status: 200,
    contentType: "application/json; charset=utf-8",
    rootType: "object",
    rootKeys: ["items", "total"],
    countType: "undefined",
    dataExists: false,
    dataIsArray: false,
    arrayKeys: ["items"],
    endpoint: "GET /leads",
  }]]);
  const serializedLog = JSON.stringify(warnings);
  assert.doesNotMatch(serializedLog, new RegExp(phone.replace("+", "\\+")));
  assert.doesNotMatch(serializedLog, new RegExp(email));
  assert.doesNotMatch(serializedLog, new RegExp(token));
  assert.doesNotMatch(serializedLog, /authorization|bearer|search=/i);
});

test("surfaces 429 and respects Retry-After", async () => {
  const client = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "secret", fetchImpl: async () => new Response('{"message":"Too many requests"}', { status: 429, headers: { "Retry-After": "30" } }) });
  await assert.rejects(() => client.searchLeads("phone", "+5511999999999"), (error) => {
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
  const client = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "secret", timeoutMs: 5, fetchImpl });
  await assert.rejects(() => client.searchLeads("phone", "+5511999999999"), /Tempo limite/);
});

test("marks network failures as temporary without leaking the token", async () => {
  const client = new DatacrazyClient({ apiUrl: "https://api.example.test/api/v1", token: "super-secret-token", fetchImpl: async () => { throw new Error("socket closed"); } });
  await assert.rejects(() => client.searchLeads("phone", "+5511999999999"), (error) => {
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
  const base = { enabled: true, apiUrl: "https://api.example.test/api/v1", timeoutMs: 8000, customFields: {}, manualTestMode: false };
  assert.throws(() => assertDatacrazyReady({ ...base, stageId: "stage" }), /TOKEN ausente/);
  assert.throws(() => assertDatacrazyReady({ ...base, token: "secret" }), /STAGE_ID ausente/);
});
