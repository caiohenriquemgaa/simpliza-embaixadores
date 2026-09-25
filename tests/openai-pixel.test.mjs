import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as pixel from "../lib/openai-pixel.ts";
import * as conversion from "../lib/conversion.ts";
import * as attribution from "../lib/attribution.ts";
import * as http from "../lib/http.ts";

const source = await readFile(new URL("../app/components/lead-form.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
let sequence = 0;
function browser(consent = "accepted", storage = new Map()) {
  const target = new EventTarget(), calls = [], hooks = [];
  globalThis.window = Object.assign(target, {
    location: { pathname: "/", href: "https://preview.test/?intent=delivery&utm_source=chatgpt", origin: "https://preview.test" },
    localStorage: { getItem: () => consent },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    oaiq: (...args) => calls.push(args), dataLayer: [],
  });
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.document = { referrer: "" };
  window.addEventListener("simpliza:lead_submitted", event => hooks.push(event.detail));
  return { calls, hooks, storage, leads: () => calls.filter(args => args[0] === "measure") };
}
function formHarness(status = 201, props = { sourceType: "institutional" }, responseBody) {
  const id = `synthetic-unit-${++sequence}`;
  const deps = {
    react: { useState: initial => [typeof initial === "function" ? initial() : initial, () => {}], useRef: initial => ({ current: initial }), useEffect: () => {} },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@/lib/http": http, "@/lib/phone": { maskBrazilianPhone: value => value },
    "@/lib/attribution": attribution, "@/lib/conversion": conversion, "./brand-icon": { Icon: () => null },
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => { assert.ok(name in deps, name); return deps[name]; }, mod, mod.exports);
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response(JSON.stringify(responseBody ?? { ok: status === 201, leadId: id }), { status, headers: { "content-type": "application/json" } }); };
  globalThis.FormData = class { get() { return ""; } };
  const tree = mod.exports.LeadForm(props);
  return { id, tree, requests: () => requests, submit: () => tree.props.onSubmit({ preventDefault() {}, currentTarget: {} }) };
}

test("A: init is once, consent precedes init, official queue holds commands", () => {
  browser("rejected"); delete window.oaiq;
  pixel.initializeOpenAiPixel(); pixel.initializeOpenAiPixel();
  assert.deepEqual(window.oaiq.q, [["consent", false], ["init", { pixelId: "L1f8X3pfviH8puvdcxZLSR" }]]);
});
test("debug is opt-in for Preview; consent changes use the official command", () => {
  const b = browser("rejected"); pixel.initializeOpenAiPixel({ debug: true });
  const cleanup = pixel.subscribeOpenAiPixel();
  assert.deepEqual(b.calls.slice(0, 2), [["consent", false], ["init", { pixelId: pixel.OPENAI_PIXEL_ID, debug: true }]]);
  window.localStorage.getItem = () => "accepted";
  window.dispatchEvent(new Event(pixel.TRACKING_CONSENT_EVENT));
  assert.deepEqual(b.calls.at(-1), ["consent", true]);
  window.localStorage.getItem = () => "rejected";
  window.dispatchEvent(new Event(pixel.TRACKING_CONSENT_EVENT));
  assert.deepEqual(b.calls.at(-1), ["consent", false]);
  cleanup();
});
test("B/I/J: actual form handler HTTP 201 emits one Lead, generate_lead and central hook", async () => {
  const b = browser(); pixel.initializeOpenAiPixel(); pixel.subscribeOpenAiPixel();
  const f = formHarness(); await f.submit(); await f.submit();
  assert.equal(b.leads().length, 1); assert.equal(b.hooks.length, 1); assert.equal(window.dataLayer.length, 1);
  assert.equal(window.dataLayer[0].event, "generate_lead");
  assert.deepEqual(b.leads()[0], ["measure", "lead_created", { type: "customer_action" }, { event_id: f.id }]);
});
for (const status of [400, 422, 500, 503, 200, 202]) {
  test(`C/D: form response ${status} never emits a conversion even with success-shaped body`, async () => {
    const b = browser(); pixel.initializeOpenAiPixel(); pixel.subscribeOpenAiPixel();
    await formHarness(status, undefined, { ok: true, leadId: "unexpected-response" }).submit();
    assert.equal(b.leads().length, 0); assert.equal(b.hooks.length, 0); assert.equal(window.dataLayer.length, 0);
  });
}
test("D: 201 without accepted ID and network failure never emit", async () => {
  const b = browser(); pixel.initializeOpenAiPixel(); pixel.subscribeOpenAiPixel();
  await formHarness(201, undefined, { ok: true }).submit();
  const f = formHarness(); globalThis.fetch = async () => { throw new Error("network failure"); }; await f.submit();
  assert.equal(b.leads().length, 0); assert.equal(b.hooks.length, 0);
});
test("E: mount, CTA and form-open events do not measure or request a lead", () => {
  const b = browser(); pixel.initializeOpenAiPixel(); pixel.subscribeOpenAiPixel(); const f = formHarness();
  for (const event of ["click", "focus", "form_open"]) window.dispatchEvent(new Event(event));
  assert.equal(f.requests(), 0); assert.equal(b.leads().length, 0);
});
test("F: refresh neither replays nor reports the same accepted ID twice", () => {
  const b = browser(); pixel.initializeOpenAiPixel();
  pixel.measureOpenAiLead({ event_id: "refresh-id", source_type: "institutional" });
  const refreshed = browser("accepted", b.storage); pixel.initializeOpenAiPixel(); pixel.subscribeOpenAiPixel();
  assert.equal(refreshed.leads().length, 0);
  pixel.measureOpenAiLead({ event_id: "refresh-id", source_type: "institutional" });
  assert.equal(refreshed.leads().length, 0);
});
test("G: ambassador form preserves existing events but never sends institutional OpenAI Lead", async () => {
  const b = browser(); pixel.initializeOpenAiPixel(); pixel.subscribeOpenAiPixel();
  for (const slug of ["felipe", "diegogirao"]) {
    window.location.pathname = `/${slug}`;
    await formHarness(201, { sourceType: "ambassador", ambassadorSlug: slug }).submit();
    pixel.measureOpenAiLead({ event_id: `bad-source-${slug}`, source_type: "institutional" });
  }
  assert.equal(b.leads().length, 0); assert.equal(b.hooks.length, 2); assert.equal(window.dataLayer.length, 2);
});
test("H: delegates oppref to official SDK, no fabricated click or redundant cookie writes", () => {
  const b = browser(); let writes = 0;
  Object.defineProperty(document, "cookie", { set() { writes++; }, configurable: true });
  pixel.initializeOpenAiPixel(); pixel.measureOpenAiLead({ event_id: "no-click-id", source_type: "institutional" });
  assert.equal(writes, 0); assert.equal(JSON.stringify(b.calls).includes("oppref"), false);
  assert.equal(pixel.OPENAI_PIXEL_SRC, "https://bzrcdn.openai.com/sdk/oaiq.min.js");
});
test("consent denied leads are not replayed after acceptance; extra personal fields never forwarded", () => {
  const b = browser("rejected"); pixel.initializeOpenAiPixel(); pixel.subscribeOpenAiPixel();
  const detail = { source_type: "institutional", event_id: "denied-id", email: "unit@example.invalid", name: "Unit Test" };
  pixel.measureOpenAiLead(detail); window.localStorage.getItem = () => "accepted";
  window.dispatchEvent(new Event(pixel.TRACKING_CONSENT_EVENT)); pixel.measureOpenAiLead(detail);
  assert.equal(b.leads().length, 0);
  pixel.measureOpenAiLead({ ...detail, event_id: "consented-id" });
  assert.deepEqual(b.leads(), [["measure", "lead_created", { type: "customer_action" }, { event_id: "consented-id" }]]);
});
test("only enabled institutional routes mount SDK; production has no debug", async () => {
  const src = await readFile(new URL("../app/components/openai-pixel.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const previous = process.env.NEXT_PUBLIC_OPENAI_PIXEL_ENABLED;
  try {
    for (const enabled of [undefined, "false", "true"]) for (const preview of [false, true]) for (const path of ["/", "/inicio", "/felipe", "/diegogirao"]) {
      const effects = [], mod = { exports: {} };
      if (enabled === undefined) delete process.env.NEXT_PUBLIC_OPENAI_PIXEL_ENABLED; else process.env.NEXT_PUBLIC_OPENAI_PIXEL_ENABLED = enabled;
      const deps = { react: { useEffect: fn => effects.push(fn) }, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) }, "next/script": { default: "script" }, "next/navigation": { usePathname: () => path }, "@/lib/openai-pixel": pixel };
      new Function("require", "module", "exports", code)(name => deps[name], mod, mod.exports);
      const b = browser(); const tree = mod.exports.OpenAiPixel({ enabled: enabled === "true", preview }); effects.forEach(fn => fn());
      const shouldLoad = enabled === "true" && pixel.isInstitutionalPath(path);
      assert.equal(tree !== null, shouldLoad); assert.equal(b.calls.length > 0, shouldLoad);
      if (shouldLoad) assert.deepEqual(b.calls[1], ["init", { pixelId: pixel.OPENAI_PIXEL_ID, ...(preview ? { debug: true } : {}) }]);
    }
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_OPENAI_PIXEL_ENABLED; else process.env.NEXT_PUBLIC_OPENAI_PIXEL_ENABLED = previous; }
});
