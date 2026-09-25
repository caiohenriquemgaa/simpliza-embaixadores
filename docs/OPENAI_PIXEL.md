# OpenAI Pixel — institutional Preview

## Consent-based Preview activation

The user explicitly authorized official automatic advanced matching under the
existing measurement consent, superseding the earlier privacy hold.
Source: **Simpliza | LP Institucional | ChatGPT Ads**.
Pixel ID: `L1f8X3pfviH8puvdcxZLSR`.

The server passes `VERCEL_ENV === "preview"` to the client component. Only Preview
loads this integration; Production remains disabled. Official `debug: true` is
restricted to Preview. No extra activation flag or AAM-disable override is used.
The existing consent is passed BEFORE init: absent/rejected means false; valid
saved acceptance means true. Banner acceptance updates the official consent
command. No new banner or visual change.

AAM remains unchanged and may attach SDK-generated SHA-256 hashes under consent.
The application never passes a `user` object or manually sends identifiers/hashes.
No Data Crazy settings/code, Supabase schema, ambassador implementation, or
production deployment was changed. One synthetic Preview lead is authorized.

## Prepared implementation

- Client component `OpenAiPixel` uses `next/script` with `afterInteractive`, only
  on `/` and `/inicio`, enabled only by the server Preview environment.
- Official queue; consent is set before the one-time `init` with the real ID.
  Uses the existing cookie preference and its new nonvisual change notification.
- The existing `simpliza:lead_submitted` hook is the only conversion input.
  The form now explicitly requires HTTP **201**, `ok`, and the accepted lead ID.
- Standard event **`lead_created`**, data **`{type: "customer_action"}`**,
  options **`{event_id: leadId}`**. The official name differs from generic “Lead”.
- No form data, attribution parameters, `user` object, amount or fabricated click
  ID is included in our SDK calls. The SDK handles origin, browser reference,
  timestamps and transport. Automatic matching follows the official SDK and existing consent.
- In-memory and sessionStorage deduplication suppress repeated accepted IDs,
  including refresh. Leads accepted without consent are not replayed on acceptance.
  A future CAPI must use the same real lead ID, event name and Pixel ID; no CAPI exists here.
- Ambassadors keep their existing conversions; the OpenAI listener checks both
  current institutional route and institutional source type.
- CSP permits the official SDK/config CDN and event endpoint; no new
  `unsafe-inline` directive was introduced.

## oppref

Delegate exclusively to the official SDK: on consent it captures an actual URL
`oppref` into `__oppref` (30 days). Institutional solution/form links are same-page
anchors, preserving the query before consent. The SDK cookie carries attribution
across subsequent pages after consent. No custom cookie, generated click ID or
extra persistence mechanism is added. Denial clears SDK cookies, per official
behavior; attribution must not bypass consent. A real advertising-attribution test
requires an actual eligible ad click.

## Tests and next validation

`tests/openai-pixel.test.mjs` adds 16 tests: queue/init, actual form handler with
201 and invalid responses, network failure, click/open, refresh, ambassadors,
SDK delegation, consent/no replay, minimal payload and Preview-only route
gating. These mock the SDK; they do not claim actual OpenAI receipt or real
`oppref` persistence. Existing API and attribution tests remain intact.

For the named branch Preview, accept measurement consent and submit exactly one authorized synthetic
lead with `intent=delivery` and the specified `teste_pixel` UTMs. Confirm HTTP201,
Supabase attribution and `crm_status=ignored`/zero attempts, one network event
and the latest-15-minute Ads Manager event stream. Do not fabricate `oppref`.
No production promotion or campaign activation is authorized by this document.

## Official references consulted

- https://developers.openai.com/ads/measurement-pixel
- https://developers.openai.com/ads/supported-events
- https://help.openai.com/en/articles/20001409-conversion-measurement

The public configuration URL was observed in the official SDK implementation:
https://bzrcdn.openai.com/pixel-config/v1/L1f8X3pfviH8puvdcxZLSR.json
It was used only for read-only audit, not as an undocumented integration API.

## Production authorization — 2026-09-25

This section supersedes the historical Preview-only deployment restriction above.
Production publication is authorized conditional on passing the existing checks.
The isolated release starts at validated institutional commit bd74d6f and reuses
the reviewed Pixel commits, excluding the later institutional CRM synchronization.
The server now enables the Pixel for Preview and Production institutional routes;
debug remains Preview-only. Consent, SDK calls and ambassador behavior are unchanged.
Institutional leads remain crm_status=ignored and never schedule CRM delivery.
Production environment settings are preserved. Campaign changes are not authorized.
Post-deploy checks must not create an unnecessary real lead or fabricated ad click.
