import assert from "node:assert/strict";
import test from "node:test";
import {
  flushMetaPixelQueue,
  META_PIXEL_CONSENT_KEY,
  trackDataLayerEvent,
  trackMetaEvent,
} from "../lib/meta-pixel.ts";

function installWindow(value) {
  Object.defineProperty(globalThis, "window", { configurable: true, value, writable: true });
}

test.afterEach(() => {
  delete globalThis.window;
});

test("queues a consented Meta event and flushes it when fbq becomes available", () => {
  const calls = [];
  installWindow({
    localStorage: { getItem: (key) => key === META_PIXEL_CONSENT_KEY ? "accepted" : null },
  });

  assert.equal(trackMetaEvent("Lead", { ambassador: "felipe" }), false);
  assert.deepEqual(window.simplizaMetaPixelQueue, [
    { event: "Lead", data: { ambassador: "felipe" } },
  ]);

  window.fbq = (...args) => calls.push(args);
  assert.equal(flushMetaPixelQueue(), 1);
  assert.deepEqual(calls, [["track", "Lead", { ambassador: "felipe" }]]);
  assert.deepEqual(window.simplizaMetaPixelQueue, []);
});

test("does not queue Meta events without tracking consent", () => {
  installWindow({ localStorage: { getItem: () => "rejected" } });

  assert.equal(trackMetaEvent("Lead"), false);
  assert.equal(window.simplizaMetaPixelQueue, undefined);
});

test("initializes dataLayer when another integration has not created it", () => {
  installWindow({});

  assert.equal(trackDataLayerEvent({ event: "generate_lead" }), true);
  assert.deepEqual(window.dataLayer, [{ event: "generate_lead" }]);
});
