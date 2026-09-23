import assert from "node:assert/strict";
import test from "node:test";
import { captureTouch, parseIntent, sourceName, readAttribution } from "../lib/attribution.ts";
import { leadSchema } from "../lib/validation.ts";
import { reportLeadAccepted } from "../lib/conversion.ts";
import { getDatacrazyConfig } from "../lib/datacrazy/config.ts";
import { institutionalCrmContext } from "../lib/datacrazy/institutional.ts";

test("captures real parameter names, bounds input and excludes secrets", () => {
  const touch = captureTouch("https://example.test/?intent=delivery&utm_source=chatgpt&utm_medium=paid_ai&campaign_id=123&opaque_click_id=abc&token=private&email=private#formulario", "https://referrer.test/article?email=private");
  assert.equal(touch.parameters.opaque_click_id, "abc");
  assert.equal(touch.parameters.campaign_id, "123");
  assert.equal(touch.parameters.token, undefined);
  assert.equal(touch.parameters.email, undefined);
  assert.equal(touch.referrer, "https://referrer.test/article");
  assert.equal(sourceName("institutional", undefined, touch), "chatgpt_ads");
  assert.equal(sourceName("ambassador", "diegogirao", touch), "diegogirao");
  assert.equal(parseIntent("invalid"), null);
});

test("first touch survives navigation, refresh and a new campaign; conversion stays current", () => {
  const data = new Map();
  globalThis.sessionStorage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  globalThis.document = { referrer: "https://chatgpt.com/" };
  globalThis.window = { location: { href: "https://example.test/?intent=delivery&utm_source=chatgpt&utm_medium=paid_ai", origin: "https://example.test" } };
  const first = readAttribution();
  window.location.href = "https://example.test/inicio";
  const next = readAttribution();
  assert.deepEqual(next.firstTouch, first.firstTouch);
  assert.equal(next.intent, "delivery");
  assert.equal(next.conversionTouch.landingUrl, "https://example.test/inicio");
  window.location.href = "https://example.test/?intent=migracao&utm_source=other";
  const latest = readAttribution();
  assert.equal(latest.firstTouch.parameters.utm_source, "chatgpt");
  assert.equal(latest.conversionTouch.parameters.utm_source, "other");
  assert.equal(latest.intent, "migracao");
  sessionStorage.setItem = () => { throw new Error("unavailable"); };
  assert.equal(readAttribution().firstTouch.parameters.utm_source, "chatgpt");
});

test("institutional validation requires no ambassador and legacy requests still require one", () => {
  const input = { name: "Teste", phone: "(41) 99999-9999", establishment: "Restaurante", sourcePage: "/", sourceUrl: "https://example.test/", monthlyRevenue: "Até R$ 20 mil", contactPreference: "whatsapp", consentLgpd: true, submittedAt: new Date().toISOString(), formStartedAt: Date.now() - 5000 };
  assert.equal(leadSchema.safeParse({ ...input, sourceType: "institutional" }).success, true);
  assert.equal(leadSchema.safeParse(input).success, false);
  const ambassador = { ambassadorId: "123e4567-e89b-42d3-a456-426614174000", ambassadorName: "Felipe", ambassadorSlug: "felipe" };
  assert.equal(leadSchema.safeParse({ ...input, ...ambassador }).success, true);
  assert.equal(leadSchema.safeParse({ ...input, ...ambassador, sourceType: "institutional" }).success, false);
});

test("conversion emits once per accepted ID and preserves Meta consent", () => {
  const touch = captureTouch("https://example.test/?intent=delivery&utm_source=chatgpt&utm_medium=paid_ai&utm_campaign=campaign", "");
  const attribution = { firstTouch: touch, conversionTouch: touch, intent: "delivery" };
  const meta = [], hooks = [];
  globalThis.window = { dataLayer: [], localStorage: { getItem: () => "rejected" }, fbq: (...args) => meta.push(args), dispatchEvent: event => hooks.push(event) };
  reportLeadAccepted("accepted-1", "institutional", "chatgpt_ads", attribution);
  reportLeadAccepted("accepted-1", "institutional", "chatgpt_ads", attribution);
  assert.equal(window.dataLayer.length, 1);
  assert.equal(window.dataLayer[0].event, "generate_lead");
  assert.equal(window.dataLayer[0].campaign, "campaign");
  assert.equal(hooks.length, 1);
  assert.equal(meta.length, 0);
  window.localStorage.getItem = () => "accepted";
  reportLeadAccepted("accepted-2", "institutional", "chatgpt_ads", attribution);
  assert.equal(meta.length, 1);
  assert.equal(institutionalCrmContext("chatgpt_ads", attribution).source, "ChatGPT Ads — Delivery");
});

test("Preview cannot synchronize CRM even if integration env is enabled", () => {
  const previous = { ...process.env };
  try {
    process.env.VERCEL_ENV = "preview";
    process.env.DATACRAZY_INTEGRATION_ENABLED = "true";
    assert.equal(getDatacrazyConfig().enabled, false);
  } finally { process.env = previous; }
});
