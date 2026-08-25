import { requireAdmin, unauthorized } from "@/lib/admin-auth";
import { ambassadorRow, relatedRows } from "@/lib/admin-data";
import { ambassadorColumns, mapAmbassadorRow } from "@/lib/ambassadors";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { ambassadorSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  if (!await requireAdmin(request)) return unauthorized();
  const { id } = await params, client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  const { data, error } = await client.from("ambassadors").select(ambassadorColumns).eq("id", id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Embaixador não encontrado." }, { status: 404 });
  return Response.json({ ambassador: mapAmbassadorRow(data) });
}

export async function PUT(request: Request, { params }: Context) {
  if (!await requireAdmin(request)) return unauthorized();
  const { id } = await params, client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  const parsed = ambassadorSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Revise os campos do embaixador.", issues: parsed.error.flatten() }, { status: 400 });
  const { error } = await client.from("ambassadors").update(ambassadorRow(parsed.data)).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const related = relatedRows(parsed.data, id);
  await Promise.all(["benefits", "testimonials", "faqs"].map((table) => client.from(table).delete().eq("ambassador_id", id)));
  const results = await Promise.all([
    related.benefits.length ? client.from("benefits").insert(related.benefits) : null,
    related.testimonials.length ? client.from("testimonials").insert(related.testimonials) : null,
    related.faqs.length ? client.from("faqs").insert(related.faqs) : null,
  ]);
  const relatedError = results.find((result) => result?.error)?.error;
  if (relatedError) return Response.json({ error: relatedError.message }, { status: 400 });
  return Response.json({ id });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!await requireAdmin(request)) return unauthorized();
  const { id } = await params, client = createServiceSupabaseClient();
  if (!client) return Response.json({ error: "Supabase não configurado." }, { status: 503 });
  const { error } = await client.from("ambassadors").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
