import assert from "node:assert/strict";
import test from "node:test";
import { createAmbassadorAssetPath, MAX_UPLOAD_SIZE, validateUploadFile, validateUploadScope } from "../lib/upload-validation.ts";

const fixtures = {
  jpeg: { bytes: [0xff,0xd8,0xff,0xe0], name: "photo.jpeg", type: "image/jpeg" },
  png: { bytes: [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], name: "photo.png", type: "image/png" },
  webp: { bytes: [0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50], name: "photo.webp", type: "image/webp" },
};

for (const [format,fixture] of Object.entries(fixtures)) {
  test(`accepts a valid ${format} signature`, async () => {
    const result = await validateUploadFile(new File([new Uint8Array(fixture.bytes)], fixture.name, { type: fixture.type }));
    assert.equal(result.ok, true);
  });
}

test("rejects a file above 5 MiB", async () => {
  const result = await validateUploadFile(new File([new Uint8Array(MAX_UPLOAD_SIZE + 1)], "large.jpg", { type: "image/jpeg" }));
  assert.deepEqual({ ok: result.ok, code: result.code, status: result.status }, { ok: false, code: "FILE_TOO_LARGE", status: 413 });
});

test("rejects a forbidden format", async () => {
  const result = await validateUploadFile(new File([new Uint8Array([0x47,0x49,0x46,0x38])], "photo.gif", { type: "image/gif" }));
  assert.deepEqual({ ok: result.ok, code: result.code, status: result.status }, { ok: false, code: "UNSUPPORTED_MEDIA_TYPE", status: 415 });
});

test("rejects an extension that disagrees with the image", async () => {
  const result = await validateUploadFile(new File([new Uint8Array(fixtures.png.bytes)], "photo.jpg", { type: "image/png" }));
  assert.deepEqual({ ok: result.ok, code: result.code, status: result.status }, { ok: false, code: "EXTENSION_MISMATCH", status: 415 });
});

test("builds collision-resistant primary and secondary paths", () => {
  const ambassadorId = "00000000-0000-4000-8000-000000000001";
  const primaryScope = validateUploadScope("primary", ambassadorId);
  const secondaryScope = validateUploadScope("secondary", ambassadorId);
  assert.equal(primaryScope.ok, true);
  assert.equal(secondaryScope.ok, true);
  const primary = createAmbassadorAssetPath(primaryScope.scope, primaryScope.kind, "jpg");
  const secondary = createAmbassadorAssetPath(secondaryScope.scope, secondaryScope.kind, "jpg");
  assert.match(primary, /^ambassadors\/00000000-0000-4000-8000-000000000001\/primary-[0-9a-f-]+\.jpg$/);
  assert.match(secondary, /^ambassadors\/00000000-0000-4000-8000-000000000001\/secondary-[0-9a-f-]+\.jpg$/);
  assert.notEqual(primary, secondary);
});
