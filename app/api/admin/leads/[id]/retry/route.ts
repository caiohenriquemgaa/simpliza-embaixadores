import { after } from "next/server";
import { z } from "zod";
import { requireAdmin, unauthorized } from "@/lib/admin-auth";
import { processNextLead } from "@/lib/datacrazy/sync";
import { createServiceSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(request)) return unauthorized();
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) return Response.json({ error: "Lead inválido." }, { status: 400 });
  const client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  const { data, error } = await client.from("leads").update({
    crm_status: "pending", crm_next_retry_at: new Date().toISOString(), crm_last_error: null,
  }).eq("id", parsed.data).neq("crm_status", "synced").select("id").maybeSingle();
  if (error) return Response.json({ error: "Não foi possível agendar a nova tentativa." }, { status: 500 });
  if (!data) return Response.json({ error: "Lead já sincronizado ou não encontrado." }, { status: 409 });
  after(async () => {
    try { await processNextLead(parsed.data, client); }
    catch { console.error("[datacrazy] Não foi possível iniciar a tentativa administrativa.", { leadId: parsed.data }); }
  });
  return Response.json({ ok: true });
}
