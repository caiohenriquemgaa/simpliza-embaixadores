import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function request(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the public landing content in the initial HTML", async () => {
  const response = await request("/");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /<h1>Gestão de restaurante não precisa ser complicada\.<\/h1>/);
  assert.match(html, /Fale com um especialista/);
  assert.match(html, /Prefere contato por/);
  assert.match(html, /Simule o plano ideal para o seu restaurante/);
  assert.match(html, /class="[^"]*planSimulator[^"]*"/);
  assert.match(html, /type="range"[^>]*aria-valuetext="R\$ 40 mil"/);
});

test("renders an ambassador route with individual SEO metadata", async () => {
  const response = await request("/embaixadores/felipe");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>Simpliza para Restaurantes \| Indicação do Felipe<\/title>/);
  assert.match(html, /rel="canonical" href="https?:\/\/[^\"]+\/embaixadores\/felipe"/);
  assert.match(html, /application\/ld\+json/);
});

test("does not expose an unknown ambassador", async () => {
  const response = await request("/embaixadores/inexistente");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Página não encontrada/);
});

test("rejects unauthenticated administrative API access with JSON", async () => {
  const response = await request("/api/admin/ambassadors");
  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  const body = await response.json();
  assert.equal(typeof body.error, "string");
});

test("marks the administrative login as noindex", async () => {
  const response = await request("/admin/login");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /name="robots" content="noindex, nofollow, (?:nocache|noarchive)"/);
});

test("keeps Meta Pixel configuration optional and tracks ambassador pages", async () => {
  const component = await readFile(new URL("../app/components/meta-pixel.tsx", import.meta.url), "utf8");
  const leadForm = await readFile(new URL("../app/components/lead-form.tsx", import.meta.url), "utf8");
  const tracker = await readFile(new URL("../lib/meta-pixel.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const exampleEnv = await readFile(new URL("../.env.example", import.meta.url), "utf8");

  assert.match(component, /NEXT_PUBLIC_META_PIXEL_ID/);
  assert.match(component, /trackMetaEvent\("PageView"/);
  assert.match(component, /trackMetaEvent\("ViewContent"/);
  assert.match(component, /ambassador_slug/);
  assert.match(tracker, /simpliza_meta_pixel_consent/);
  assert.match(tracker, /simplizaMetaPixelQueue/);
  assert.match(leadForm, /trackMetaEvent\("Lead"/);
  assert.match(layout, /<MetaPixel \/>/);
  assert.match(exampleEnv, /^NEXT_PUBLIC_META_PIXEL_ID=/m);
});
