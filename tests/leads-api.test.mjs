import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as validation from "../lib/validation.ts";
import * as attribution from "../lib/attribution.ts";
import * as institutional from "../lib/datacrazy/institutional.ts";

const source = await readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const ambassador = { id: "123e4567-e89b-42d3-a456-426614174000", name: "Felipe", slug: "felipe", campaign_code: "felipe-campaign" };
function harness({ duplicate = false, fail = false } = {}) {
  let row, afterCount = 0;
  const client = { from(table) {
    const query = {
      select() { return query; }, eq() { return query; },
      insert(value) { row = value; return query; },
      async maybeSingle() {
        if (table === "ambassadors") return { data: ambassador, error: null };
        if (row && fail) return { error: { code: "failure" } };
        if (row && duplicate) { duplicate = false; return { error: { code: "23505" } }; }
        return { data: { id: "accepted-id" }, error: null };
      },
    };
    return query;
  } };
  const dependencies = {
    "next/server": { after() { afterCount++; } },
    "@/lib/attribution": attribution,
    "@/lib/datacrazy/institutional": institutional,
    "@/lib/validation": validation,
    "@/lib/supabase": { createServiceSupabaseClient: () => client },
    "@/lib/datacrazy/sync": { normalizeBrazilianPhone: () => "+5541999999999", processNextLead() { throw new Error("CRM must never be contacted in tests"); } },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }, module, module.exports);
  return { post: module.exports.POST, row: () => row, afterCount: () => afterCount };
}
function payload(overrides = {}) {
  return { name: "Teste", phone: "(41) 99999-9999", establishment: "Teste", monthlyRevenue: "Até R$ 20 mil", contactPreference: "whatsapp", consentLgpd: true, submittedAt: new Date().toISOString(), formStartedAt: Date.now() - 5000, sourceType: "institutional", sourcePage: "/inicio", sourceUrl: "https://preview.test/inicio", ...overrides };
}
function request(body, origin = "https://preview.test") {
  return new Request("https://preview.test/api/leads", { method: "POST", headers: { "content-type": "application/json", origin, "idempotency-key": "123e4567-e89b-42d3-a456-426614174001" }, body: JSON.stringify(body) });
}
test("institutional API persists first touch and prepared CRM context without ambassador", async () => {
  const h = harness();
  const touch = attribution.captureTouch("https://preview.test/?intent=delivery&utm_source=chatgpt&utm_medium=paid_ai&utm_campaign=test&campaign_code=42&click_id=abc", "https://chatgpt.com/");
  const response = await h.post(request(payload({ attribution: { firstTouch: touch, conversionTouch: touch, intent: "delivery" } })));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, leadId: "accepted-id" });
  assert.equal(h.row().ambassador_id, null);
  assert.equal(h.row().source_name, "chatgpt_ads");
  assert.equal(h.row().utm_campaign, "test");
  assert.equal(h.row().attribution.firstTouch.parameters.campaign_code, "42");
  assert.equal(h.row().attribution.crmContext.source, "ChatGPT Ads — Delivery");
  assert.equal(h.row().attribution.conversionTouch.landingUrl, "https://preview.test/inicio");
  assert.equal(h.row().crm_status, "ignored");
  assert.equal(h.afterCount(), 0);
});
test("ambassador API retains database identity and schedules the existing integration", async () => {
  const h = harness();
  const response = await h.post(request(payload({ sourceType: "ambassador", ambassadorId: ambassador.id, ambassadorName: "Incorrect client name", ambassadorSlug: "felipe", sourcePage: "/embaixadores/felipe", sourceUrl: "https://preview.test/embaixadores/felipe" })));
  assert.equal(response.status, 201);
  assert.equal(h.row().ambassador_name, "Felipe");
  assert.equal(h.row().campaign_code, "felipe-campaign");
  assert.equal(h.row().crm_status, "pending");
  assert.equal(h.afterCount(), 1);
});
test("database rejection never returns a conversion ID; retries return the existing ID", async () => {
  const failure = await harness({ fail: true }).post(request(payload()));
  assert.equal(failure.status, 500);
  assert.equal((await failure.json()).leadId, undefined);
  const duplicate = await harness({ duplicate: true }).post(request(payload()));
  assert.deepEqual(await duplicate.json(), { ok: true, leadId: "accepted-id" });
});
test("origin, route, body limit and antispam reject without writing", async () => {
  for (const [body, origin, expected] of [
    [payload(), "https://other.test", 403],
    [payload({ sourcePage: "/felipe", sourceUrl: "https://preview.test/felipe" }), undefined, 400],
    [payload({ formStartedAt: Date.now() }), undefined, 400],
    [payload({ extra: "x".repeat(17000) }), undefined, 413],
  ]) {
    const h = harness();
    assert.equal((await h.post(request(body, origin))).status, expected);
    assert.equal(h.row(), undefined);
  }
});
test("Preview defaults to no database writes and never schedules CRM", async () => {
  const old = { ...process.env };
  try {
    process.env.VERCEL_ENV = "preview";
    delete process.env.LEADS_PREVIEW_WRITES_ENABLED;
    const h = harness();
    assert.equal((await h.post(request(payload()))).status, 503);
    assert.equal(h.row(), undefined);
    process.env.LEADS_PREVIEW_WRITES_ENABLED = "true";
    assert.equal((await h.post(request(payload()))).status, 201);
    assert.equal(h.row().crm_status, "ignored");
    assert.equal(h.afterCount(), 0);
  } finally { process.env = old; }
});
