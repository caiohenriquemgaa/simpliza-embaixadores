import { captureTouch, sourceName } from "@/lib/attribution";
import { institutionalCrmContext } from "@/lib/datacrazy/institutional";
import { after } from "next/server";
import { normalizeBrazilianPhone, processNextLead } from "@/lib/datacrazy/sync";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { idempotencyKeySchema, leadSchema } from "@/lib/validation";

const MAX_BODY_BYTES = 16 * 1024;

function allowedSourcePath(pathname: string, slug: string) {
  return pathname === `/embaixadores/${slug}` || pathname === `/${slug}`;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return Response.json({ error: "Dados enviados excedem o limite permitido." }, { status: 413 });

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return Response.json({ error: "Dados enviados excedem o limite permitido." }, { status: 413 });
    body = JSON.parse(text);
  }
  catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  const parsed = leadSchema.safeParse(body);
  const requestKey = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
  if (!parsed.success || !requestKey.success) return Response.json({ error: "Revise os campos informados." }, { status: 400 });
  const value = parsed.data;
  if (value.website || Date.now() - value.formStartedAt < 2500) return Response.json({ error: "Aguarde alguns segundos e tente novamente." }, { status: 400 });

  // Preview must not write into a shared production database by default.
  if (process.env.VERCEL_ENV === "preview" && process.env.LEADS_PREVIEW_WRITES_ENABLED !== "true") {
    return Response.json({ error: "O envio de contatos neste Preview aguarda a configuração do banco de testes." }, { status: 503 });
  }
  const client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "O recebimento de contatos ainda não foi configurado. Tente novamente mais tarde." }, { status: 503 });
  const institutional = value.sourceType === "institutional";
  const { data: ambassador, error: ambassadorError } = institutional ? { data: null, error: null } : await client.from("ambassadors")
    .select("id,name,slug,campaign_code,status")
    .eq("id", value.ambassadorId!)
    .eq("slug", value.ambassadorSlug!)
    .eq("status", "published")
    .maybeSingle();
  if (!institutional && (ambassadorError || !ambassador)) return Response.json({ error: "Página de embaixador inválida." }, { status: 400 });

  let sourceUrl: URL;
  try { sourceUrl = new URL(value.sourceUrl); }
  catch { return Response.json({ error: "Página de origem inválida." }, { status: 400 }); }
  if (sourceUrl.origin !== requestUrl.origin || sourceUrl.pathname !== value.sourcePage || !(institutional ? ["/", "/inicio"].includes(value.sourcePage) : allowedSourcePath(value.sourcePage, ambassador!.slug))) {
    return Response.json({ error: "Página de origem inválida." }, { status: 400 });
  }
  const submittedTouch = value.attribution?.firstTouch;
  const firstTouch = submittedTouch ? captureTouch(submittedTouch.landingUrl, submittedTouch.referrer, submittedTouch.capturedAt) : captureTouch(sourceUrl.href, "");
  if (new URL(firstTouch.landingUrl).origin !== requestUrl.origin) return Response.json({ error: "Atribuição inválida." }, { status: 400 });
  const conversionTouch = captureTouch(sourceUrl.href, firstTouch.referrer);
  const attribution = { firstTouch, conversionTouch, intent: value.attribution?.intent ?? null };
  const utms = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map(key => [key, firstTouch.parameters[key] || null]));
  const originName = sourceName(value.sourceType, ambassador?.slug, firstTouch);

  let phone: string;
  try { phone = normalizeBrazilianPhone(value.phone); }
  catch { return Response.json({ error: "Revise o telefone informado." }, { status: 400 }); }
  const id = crypto.randomUUID();
  const row = {
    id, crm_external_id: id, client_request_id: requestKey.data,
    name: value.name, phone: value.phone, phone_normalized: phone,
    email: value.email || null, establishment: value.establishment, city: value.city || null,
    ambassador_id: ambassador?.id ?? null, ambassador_name: ambassador?.name ?? null, ambassador_slug: ambassador?.slug ?? null,
    source_type: value.sourceType, source_name: originName, intent: attribution.intent, attribution: { ...attribution, ...(institutional ? { crmContext: institutionalCrmContext(originName, attribution) } : {}) },
    campaign_code: ambassador?.campaign_code || null, source_page: value.sourcePage, source_url: sourceUrl.href,
    monthly_revenue: value.monthlyRevenue || null, contact_preference: value.contactPreference,
    consent_lgpd: true, consent_at: new Date().toISOString(), crm_status: process.env.VERCEL_ENV === "preview" || institutional ? "ignored" : "pending",
    ...utms,
  };
  const { data: inserted, error } = await client.from("leads").insert(row).select("id").maybeSingle();
  if (error && error.code !== "23505") return Response.json({ error: "Não foi possível registrar seu contato agora." }, { status: 500 });

  let leadId = inserted?.id as string | undefined;
  if (!leadId) {
    const duplicate = await client.from("leads").select("id").eq("client_request_id", requestKey.data).maybeSingle();
    leadId = duplicate.data?.id as string | undefined;
  }
  if (!leadId) return Response.json({ error: "Não foi possível registrar seu contato agora." }, { status: 500 });

  if (process.env.VERCEL_ENV !== "preview" && !institutional) after(async () => {
    try { await processNextLead(leadId, client); }
    catch { console.error("[datacrazy] Não foi possível iniciar a sincronização pós-resposta.", { leadId }); }
  });
  return Response.json({ ok: true, leadId }, { status: 201 });
}
