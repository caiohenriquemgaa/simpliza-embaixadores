import { requireAdmin, unauthorized } from "@/lib/admin-auth";
import { ambassadorRow, relatedRows } from "@/lib/admin-data";
import { ambassadorColumns, mapAmbassadorRow } from "@/lib/ambassadors";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { ambassadorSchema } from "@/lib/validation";

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return unauthorized();
  const client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  const url = new URL(request.url), search = url.searchParams.get("search") ?? "", status = url.searchParams.get("status") ?? "";
  let query = client.from("ambassadors").select(ambassadorColumns).order("updated_at", { ascending: false });
  if (search) query = query.ilike("name", `%${search}%`);
  if (["draft", "published", "archived"].includes(status)) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ambassadors: (data ?? []).map(mapAmbassadorRow) });
}

export async function POST(request: Request) {
  if (!await requireAdmin(request)) return unauthorized();
  const client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  const parsed = ambassadorSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Revise os campos do embaixador.", issues: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await client.from("ambassadors").insert(ambassadorRow(parsed.data)).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const related = relatedRows(parsed.data, data.id);
  const results = await Promise.all([
    related.benefits.length ? client.from("benefits").insert(related.benefits) : null,
    related.testimonials.length ? client.from("testimonials").insert(related.testimonials) : null,
    related.faqs.length ? client.from("faqs").insert(related.faqs) : null,
  ]);
  const relatedError = results.find((result) => result?.error)?.error;
  if (relatedError) { await client.from("ambassadors").delete().eq("id", data.id); return Response.json({ error: relatedError.message }, { status: 400 }); }
  return Response.json({ id: data.id }, { status: 201 });
}
