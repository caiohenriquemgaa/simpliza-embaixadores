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
