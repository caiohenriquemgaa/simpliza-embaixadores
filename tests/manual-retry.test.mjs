import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runManualRetry } from "../lib/datacrazy/manual-retry.ts";

test("administrative retry route awaits processing instead of scheduling after the response", async () => {
  const source = await readFile(new URL("../app/api/admin/leads/[id]/retry/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']next\/server["']/);
  assert.match(source, /await runManualRetry\(\(\) => processNextLead\(/);
});

test("manual retry awaits the real processor before reporting success", async () => {
  let release;
  let settled = false;
  const processing = runManualRetry(() => new Promise((resolve) => { release = resolve; }));
  processing.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);

  release({ status: "synced", leadId: "lead-1" });
  const outcome = await processing;
  assert.equal(outcome.statusCode, 200);
  assert.deepEqual(outcome.body, {
    ok: true, status: "synced", message: "Lead sincronizado com o DataCrazy.",
  });
});

test("manual retry returns the processor failure and retry time", async () => {
  const outcome = await runManualRetry(async () => ({
    status: "failed", leadId: "lead-1", error: "Campo adicional obrigatório não encontrado.",
    nextRetry: "2026-08-26T21:00:00.000Z",
  }));
  assert.equal(outcome.statusCode, 502);
  assert.equal(outcome.body.error, "Campo adicional obrigatório não encontrado.");
  assert.equal(outcome.body.nextRetry, "2026-08-26T21:00:00.000Z");
  assert.equal(outcome.persistError, undefined);
});

test("manual retry exposes safe pre-claim blockers and asks the route to persist them", async () => {
  const cases = [
    ["disabled", "Integração DataCrazy desativada neste ambiente.", 503],
    ["manual-test-skipped", "Este lead não corresponde à allowlist do modo de teste manual.", 409],
  ];
  for (const [status, error, statusCode] of cases) {
    const outcome = await runManualRetry(async () => ({ status, leadId: "lead-1" }));
    assert.equal(outcome.statusCode, statusCode);
    assert.equal(outcome.body.error, error);
    assert.equal(outcome.persistError, error);
  }
});

test("manual retry does not expose an unexpected value from a misconfigured integration", async () => {
  const outcome = await runManualRetry(async () => ({
    status: "misconfigured", error: "DATACRAZY_API_TOKEN ausente.",
  }));
  assert.equal(outcome.statusCode, 503);
  assert.equal(outcome.body.error, "DATACRAZY_API_TOKEN ausente.");
  assert.doesNotMatch(JSON.stringify(outcome), /Bearer|secret|authorization/i);
});
