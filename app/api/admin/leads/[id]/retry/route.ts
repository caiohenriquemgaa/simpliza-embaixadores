import { z } from "zod";
import { requireAdmin, unauthorized } from "@/lib/admin-auth";
import { runManualRetry } from "@/lib/datacrazy/manual-retry";
import { processNextLead } from "@/lib/datacrazy/sync";
import { createServiceSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(request)) return unauthorized();
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) return Response.json({ error: "Lead inválido." }, { status: 400 });
  const client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  const { data, error } = await client.from("leads").update({
    crm_status: "pending", crm_next_retry_at: null, crm_last_error: null,
  }).eq("id", parsed.data).in("crm_status", ["pending", "failed", "ignored"]).select("id").maybeSingle();
  if (error) return Response.json({ error: "Não foi possível preparar a nova tentativa." }, { status: 500 });
  if (!data) return Response.json({ error: "Lead já sincronizado ou não encontrado." }, { status: 409 });

  try {
    const outcome = await runManualRetry(() => processNextLead(parsed.data, client));
    if (outcome.persistError) {
      const { error: persistError } = await client.from("leads").update({
        crm_last_error: outcome.persistError,
      }).eq("id", parsed.data).eq("crm_status", "pending");
      if (persistError) {
        console.error("[datacrazy] Não foi possível registrar a falha administrativa.", { leadId: parsed.data });
        return Response.json({ error: "A tentativa falhou e o estado não pôde ser atualizado." }, { status: 500 });
      }
    }
    return Response.json(outcome.body, { status: outcome.statusCode });
  } catch {
    const safeError = "Não foi possível iniciar a sincronização com o DataCrazy.";
    await client.from("leads").update({ crm_last_error: safeError }).eq("id", parsed.data).eq("crm_status", "pending");
    console.error("[datacrazy] Não foi possível iniciar a tentativa administrativa.", { leadId: parsed.data });
    return Response.json({ error: safeError }, { status: 500 });
  }
}
