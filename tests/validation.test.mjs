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
    sourcePage: "//example.com",
    consentLgpd: true,
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
    sourcePage: "/embaixadores/felipe",
    consentLgpd: true,
    formStartedAt: Date.now() - 3000,
  };
  assert.equal(leadSchema.safeParse(baseLead).success, false);
  assert.equal(leadSchema.safeParse({ ...baseLead, monthlyRevenue: "Até R$ 20 mil", contactPreference: "whatsapp" }).success, true);
  assert.equal(leadSchema.safeParse({ ...baseLead, monthlyRevenue: "Prefiro não informar", contactPreference: "email" }).success, false);
});
