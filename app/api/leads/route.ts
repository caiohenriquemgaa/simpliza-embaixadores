import { after } from "next/server";
import { normalizeBrazilianPhone, processNextLead } from "@/lib/datacrazy/sync";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { idempotencyKeySchema, leadSchema } from "@/lib/validation";

const MAX_BODY_BYTES = 16 * 1024;

function allowedSourcePath(pathname: string, slug: string) {
  return pathname === `/embaixadores/${slug}` || (pathname === "/" && slug === "felipe");
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return Response.json({ error: "Dados enviados excedem o limite permitido." }, { status: 413 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  const parsed = leadSchema.safeParse(body);
  const requestKey = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
  if (!parsed.success || !requestKey.success) return Response.json({ error: "Revise os campos informados." }, { status: 400 });
  const value = parsed.data;
  if (value.website || Date.now() - value.formStartedAt < 2500) return Response.json({ ok: true }, { status: 201 });

  const client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "O recebimento de contatos ainda não foi configurado. Tente novamente mais tarde." }, { status: 503 });
  const { data: ambassador, error: ambassadorError } = await client.from("ambassadors")
    .select("id,name,slug,campaign_code,status")
    .eq("id", value.ambassadorId)
    .eq("slug", value.ambassadorSlug)
    .eq("status", "published")
    .maybeSingle();
  if (ambassadorError || !ambassador) return Response.json({ error: "Página de embaixador inválida." }, { status: 400 });

  let sourceUrl: URL;
  try { sourceUrl = new URL(value.sourceUrl); }
  catch { return Response.json({ error: "Página de origem inválida." }, { status: 400 }); }
  if (sourceUrl.origin !== requestUrl.origin || sourceUrl.pathname !== value.sourcePage || !allowedSourcePath(value.sourcePage, ambassador.slug)) {
    return Response.json({ error: "Página de origem inválida." }, { status: 400 });
  }
  const utms = {
    utm_source: sourceUrl.searchParams.get("utm_source"),
    utm_medium: sourceUrl.searchParams.get("utm_medium"),
    utm_campaign: sourceUrl.searchParams.get("utm_campaign"),
    utm_content: sourceUrl.searchParams.get("utm_content"),
    utm_term: sourceUrl.searchParams.get("utm_term"),
  };
  if (Object.values(utms).some((item) => item && item.length > 200)) {
    return Response.json({ error: "Parâmetros de origem inválidos." }, { status: 400 });
  }

  let phone: string;
  try { phone = normalizeBrazilianPhone(value.phone); }
  catch { return Response.json({ error: "Revise o telefone informado." }, { status: 400 }); }
  const id = crypto.randomUUID();
  const row = {
    id, crm_external_id: id, client_request_id: requestKey.data,
    name: value.name, phone: value.phone, phone_normalized: phone,
    email: value.email || null, establishment: value.establishment, city: value.city || null,
    ambassador_id: ambassador.id, ambassador_name: ambassador.name, ambassador_slug: ambassador.slug,
    campaign_code: ambassador.campaign_code || null, source_page: value.sourcePage, source_url: sourceUrl.href,
    monthly_revenue: value.monthlyRevenue || null, contact_preference: value.contactPreference,
    consent_lgpd: true, consent_at: new Date().toISOString(), crm_status: "pending",
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

  after(async () => {
    try { await processNextLead(leadId, client); }
    catch { console.error("[datacrazy] Não foi possível iniciar a sincronização pós-resposta.", { leadId }); }
  });
  return Response.json({ ok: true }, { status: 201 });
}
