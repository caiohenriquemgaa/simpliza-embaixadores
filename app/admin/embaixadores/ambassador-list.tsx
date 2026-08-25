"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Ambassador } from "@/lib/types";
import { readJsonResponse } from "@/lib/http";
import { adminFetch, getBrowserSupabase } from "@/lib/supabase-browser";

function withoutId<T extends { id?: string }>(item: T) { const copy = { ...item }; delete copy.id; return copy; }

export function AmbassadorList() {
  const router = useRouter();
  const [items, setItems] = useState<Ambassador[]>([]), [search, setSearch] = useState(""), [filter, setFilter] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setMessage("");
    try {
      const response = await adminFetch(`/api/admin/ambassadors?search=${encodeURIComponent(search)}&status=${filter}`);
      const result = await readJsonResponse<{ ambassadors?: Ambassador[]; error?: string }>(response);
      if (!response.ok || !result) { setMessage(result?.error ?? "Falha ao carregar embaixadores."); return; }
      setItems(result.ambassadors ?? []);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error("[admin/ambassadors] Falha ao carregar.", error);
      setMessage("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }, [search, filter]);
  // Data loading is the external synchronization performed by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function remove(id: string) { if (!confirm("Excluir permanentemente este embaixador e seus conteúdos?")) return; const response = await adminFetch(`/api/admin/ambassadors/${id}`, { method: "DELETE" }); if (!response.ok) { setMessage("Não foi possível excluir."); return; } void load(); }
  async function change(ambassador: Ambassador, status: Ambassador["status"]) { const response = await adminFetch(`/api/admin/ambassadors/${ambassador.id}`, { method: "PUT", body: JSON.stringify({ ...ambassador, status }) }); if (!response.ok) { setMessage("Não foi possível alterar o status."); return; } void load(); }
  async function duplicate(ambassador: Ambassador) { const copy = { ...ambassador, name: `${ambassador.name} (cópia)`, slug: `${ambassador.slug}-copia-${items.length + 1}`, status: "draft" as const, benefits: ambassador.benefits.map(withoutId), testimonials: ambassador.testimonials.map(withoutId), faqs: ambassador.faqs.map(withoutId) }; const response = await adminFetch("/api/admin/ambassadors", { method: "POST", body: JSON.stringify(copy) }); if (!response.ok) { setMessage("Não foi possível duplicar."); return; } void load(); }
  async function preview(id: string) { try { const response = await adminFetch("/api/admin/preview", { method: "POST", body: JSON.stringify({ id }) }); const result = await readJsonResponse<{ url?: string; error?: string }>(response); if (!response.ok || !result?.url) { setMessage(result?.error ?? "Não foi possível abrir a prévia."); return; } window.open(result.url, "_blank", "noopener,noreferrer"); } catch { setMessage("Não foi possível conectar ao servidor."); } }
  async function logout() { await getBrowserSupabase()?.auth.signOut(); router.replace("/admin/login"); router.refresh(); }
  function updateSearch(value: string) { setLoading(true); setSearch(value); }
  function updateFilter(value: string) { setLoading(true); setFilter(value); }
  return <main className="adminShell"><div className="adminCard"><div className="adminHeader"><div><h1>Embaixadores</h1><p>Cadastre, publique e acompanhe as páginas do programa.</p></div><div className="adminActions"><Link className="btn primary" href="/admin/embaixadores/novo">Novo embaixador</Link><button className="btn secondary" onClick={logout}>Sair</button></div></div><div className="adminActions adminFilters"><input aria-label="Pesquisar por nome" placeholder="Pesquisar por nome" value={search} onChange={(event) => updateSearch(event.target.value)} /><select aria-label="Filtrar por status" value={filter} onChange={(event) => updateFilter(event.target.value)}><option value="">Todos</option><option value="published">Ativos</option><option value="draft">Rascunhos</option><option value="archived">Inativos</option></select></div>{message ? <p className="formError" role="alert">{message}</p> : null}{loading ? <p role="status">Carregando...</p> : items.length === 0 ? <p className="adminNotice">Nenhum embaixador encontrado.</p> : <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Nome</th><th>Slug</th><th>Status</th><th>Atualizado</th><th>Ações</th></tr></thead><tbody>{items.map((ambassador) => <tr key={ambassador.id}><td>{ambassador.name}</td><td>/{ambassador.slug}</td><td><span className={`status status-${ambassador.status}`}>{ambassador.status}</span></td><td>{ambassador.updatedAt ? new Date(ambassador.updatedAt).toLocaleDateString("pt-BR") : "—"}</td><td><div className="adminActions"><Link href={`/admin/embaixadores/${ambassador.id}/editar`}>Editar</Link>{ambassador.status === "published" ? <Link href={`/embaixadores/${ambassador.slug}`} target="_blank" rel="noreferrer">Visualizar</Link> : null}<button onClick={() => preview(ambassador.id)}>Prévia</button><button onClick={() => duplicate(ambassador)}>Duplicar</button>{ambassador.status !== "published" ? <button onClick={() => change(ambassador, "published")}>Publicar</button> : <button onClick={() => change(ambassador, "draft")}>Despublicar</button>}<button onClick={() => change(ambassador, "archived")}>Arquivar</button><button className="dangerAction" onClick={() => remove(ambassador.id)}>Excluir</button></div></td></tr>)}</tbody></table></div>}</div></main>;
}
