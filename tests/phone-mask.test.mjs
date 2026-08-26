import assert from "node:assert/strict";
import test from "node:test";
import { maskBrazilianPhone } from "../lib/phone.ts";

test("mantém telefone brasileiro já formatado", () => {
  assert.equal(maskBrazilianPhone("(44) 99713-9390"), "(44) 99713-9390");
});

test("formata telefone brasileiro nacional sem pontuação", () => {
  assert.equal(maskBrazilianPhone("44997139390"), "(44) 99713-9390");
});

test("remove o DDI de telefone internacional com sinal de mais", () => {
  assert.equal(maskBrazilianPhone("+5544997139390"), "(44) 99713-9390");
});

test("remove o DDI de telefone internacional separado por espaços", () => {
  assert.equal(maskBrazilianPhone("55 44 99713-9390"), "(44) 99713-9390");
});

test("limita o telefone nacional a 11 dígitos", () => {
  assert.equal(maskBrazilianPhone("44997139390123"), "(44) 99713-9390");
});
