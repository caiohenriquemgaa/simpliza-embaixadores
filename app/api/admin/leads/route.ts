import { requireAdmin, unauthorized } from "@/lib/admin-auth";
import { createServiceSupabaseClient } from "@/lib/supabase";

const COLUMNS = "id,name,establishment,ambassador_name,ambassador_slug,crm_status,crm_attempts,datacrazy_lead_id,datacrazy_business_id,crm_last_attempt_at,crm_last_error,crm_next_retry_at,created_at";

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return unauthorized();
  const client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  const status = new URL(request.url).searchParams.get("status");
  let query = client.from("leads").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (["pending", "processing", "synced", "failed"].includes(status ?? "")) query = query.eq("crm_status", status);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Não foi possível carregar os leads." }, { status: 500 });
  return Response.json({ leads: data ?? [] });
}
