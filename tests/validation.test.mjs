import assert from "node:assert/strict";
import test from "node:test";
import { ambassadorSchema, leadSchema } from "../lib/validation.ts";
import { felipeSeed } from "../lib/seed.ts";

test("accepts the approved internal CTA anchors", () => {
  assert.equal(ambassadorSchema.safeParse(felipeSeed).success, true);
});

test("rejects executable protocols in managed URLs", () => {
  const result = ambassadorSchema.safeParse({ ...felipeSeed, primaryCtaUrl: "javascript:alert(1)" });
  assert.equal(result.success, false);
});

test("rejects protocol-relative source pages", () => {
  const result = leadSchema.safeParse({
    name: "Teste",
    phone: "(11) 99999-9999",
    establishment: "Restaurante Teste",
    ambassadorId: felipeSeed.id,
    ambassadorName: felipeSeed.name,
    ambassadorSlug: felipeSeed.slug,
    sourcePage: "//example.com",
    sourceUrl: "https://example.com/embaixadores/felipe?utm_source=teste",
    contactPreference: "whatsapp",
    consentLgpd: true,
    submittedAt: new Date().toISOString(),
    formStartedAt: Date.now() - 3000,
  });
  assert.equal(result.success, false);
});

test("requires an approved revenue range and contact preference", () => {
  const baseLead = {
    name: "Teste",
    phone: "(11) 99999-9999",
    establishment: "Restaurante Teste",
    ambassadorId: felipeSeed.id,
    ambassadorName: felipeSeed.name,
    ambassadorSlug: felipeSeed.slug,
    sourcePage: "/embaixadores/felipe",
    sourceUrl: "https://example.com/embaixadores/felipe",
    consentLgpd: true,
    submittedAt: new Date().toISOString(),
    formStartedAt: Date.now() - 3000,
  };
  assert.equal(leadSchema.safeParse(baseLead).success, false);
  assert.equal(leadSchema.safeParse({ ...baseLead, monthlyRevenue: "Até R$ 20 mil", contactPreference: "whatsapp" }).success, true);
  assert.equal(leadSchema.safeParse({ ...baseLead, monthlyRevenue: "Prefiro não informar", contactPreference: "email" }).success, false);
});

test("accepts attribution, UTMs and contact preference", () => {
  const result = leadSchema.safeParse({
    name: "Teste Autorizado", phone: "(11) 99999-9999", email: "lead@example.com",
    establishment: "Restaurante Teste", city: "São Paulo", ambassadorId: felipeSeed.id,
    ambassadorName: felipeSeed.name, ambassadorSlug: felipeSeed.slug, campaignCode: felipeSeed.campaignCode,
    sourcePage: "/embaixadores/felipe", sourceUrl: "https://example.com/embaixadores/felipe?utm_source=instagram",
    monthlyRevenue: "Até R$ 30 mil", contactPreference: "email", consentLgpd: true,
    submittedAt: new Date().toISOString(), formStartedAt: Date.now() - 3000,
    utmSource: "instagram", utmMedium: "social", utmCampaign: "embaixadores", utmContent: "bio", utmTerm: "gestão",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.ambassadorId, felipeSeed.id);
  assert.equal(result.data.utmSource, "instagram");
});
