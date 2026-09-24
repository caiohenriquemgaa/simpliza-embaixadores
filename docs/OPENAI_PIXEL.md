# OpenAI Pixel — institutional Preview

## Privacy blocker (2026-09-24)

Source **Simpliza | LP Institucional | ChatGPT Ads**, Pixel ID
`L1f8X3pfviH8puvdcxZLSR`, confirmed through Ads Manager.
The official SDK's public per-pixel configuration returned
`automatic_advanced_matching_enabled: true`. Ads Manager's Edit Pixel dialog
describes automatic detection/hashing of customer information but exposes no
disable control. Current official documentation provides no client-side option
to disable automatic advanced matching. Omitting `user` is not sufficient.

Therefore `NEXT_PUBLIC_OPENAI_PIXEL_ENABLED` defaults to disabled. No SDK is
loaded, initialized, or sent any events while this flag is absent/false. Do not
enable it until the source's automatic matching has been disabled through an
official supported control (or support) and verified. Do not invent an SDK option,
block the configuration request, modify the SDK, or accept hashed PII as a workaround.
No real lead was created for this task; the single authorized test remains pending.
No Data Crazy code/settings, database schema/history, or production configuration
was changed.

## Prepared implementation

- Client component `OpenAiPixel` uses `next/script` with `afterInteractive`, only
  on `/` and `/inicio`, behind the explicit activation flag.
- Official queue; consent is set before the one-time `init` with the real ID.
  Uses the existing cookie preference and its new nonvisual change notification.
- The existing `simpliza:lead_submitted` hook is the only conversion input.
  The form now explicitly requires HTTP **201**, `ok`, and the accepted lead ID.
- Standard event **`lead_created`**, data **`{type: "customer_action"}`**,
  options **`{event_id: leadId}`**. The official name differs from generic “Lead”.
- No form data, attribution parameters, `user` object, amount or fabricated click
  ID is included in our SDK calls. The SDK handles origin, browser reference,
  timestamps and transport. Disabling automatic matching is an activation prerequisite.
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
behavior; attribution must not bypass consent. Live cookie/transport verification
remains pending while the SDK is blocked; a real advertising-attribution test
requires an actual eligible ad click.

## Tests and next validation

`tests/openai-pixel.test.mjs` adds 15 tests: queue/init, actual form handler with
201 and invalid responses, network failure, click/open, refresh, ambassadors,
SDK delegation, consent/no replay, minimal payload and disabled-by-default route
gating. These mock the SDK; they do not claim actual OpenAI receipt or real
`oppref` persistence. Existing API and attribution tests remain intact.

After resolving automatic matching, enable only the named branch's Preview,
redeploy, accept measurement consent and submit exactly one authorized synthetic
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
