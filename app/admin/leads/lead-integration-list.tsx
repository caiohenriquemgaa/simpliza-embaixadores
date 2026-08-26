"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/http";
import { adminFetch } from "@/lib/supabase-browser";

type LeadRow = {
  id: string; name: string; establishment: string; ambassador_name?: string; ambassador_slug?: string;
  crm_status: "pending" | "processing" | "synced" | "failed"; crm_attempts: number;
  datacrazy_lead_id?: string; datacrazy_business_id?: string; crm_last_attempt_at?: string;
  crm_last_error?: string; crm_next_retry_at?: string; created_at: string;
};

const labels = { pending: "Pendente", processing: "Processando", synced: "Sincronizado", failed: "Falhou" };

export function LeadIntegrationList() {
  const [items, setItems] = useState<LeadRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const response = await adminFetch(`/api/admin/leads?status=${encodeURIComponent(status)}`);
      const result = await readJsonResponse<{ leads?: LeadRow[]; error?: string }>(response);
      if (!response.ok || !result) throw new Error(result?.error ?? "Falha ao carregar leads.");
      setItems(result.leads ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao carregar leads."); }
    finally { setLoading(false); }
  }, [status]);
  // Data loading is the external synchronization performed by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function retry(id: string) {
    setMessage("");
    const response = await adminFetch(`/api/admin/leads/${id}/retry`, { method: "POST" });
    const result = await readJsonResponse<{ error?: string }>(response);
    if (!response.ok) { setMessage(result?.error ?? "Não foi possível tentar novamente."); return; }
    setMessage("Nova tentativa agendada.");
    void load();
  }

  const date = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "—";
  return <main className="adminShell"><div className="adminCard">
    <div className="adminHeader"><div><h1>Integração de leads</h1><p>Acompanhe o envio seguro dos contatos ao DataCrazy.</p></div><div className="adminActions"><Link href="/admin/embaixadores">Embaixadores</Link></div></div>
    <div className="adminActions adminFilters"><select aria-label="Filtrar integração" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="pending">Pendentes</option><option value="processing">Processando</option><option value="synced">Sincronizados</option><option value="failed">Falharam</option></select><button onClick={() => void load()}>Atualizar</button></div>
    {message && <p className={message.includes("agendada") ? "adminNotice" : "formError"} role="status">{message}</p>}
    {loading ? <p role="status">Carregando...</p> : items.length === 0 ? <p className="adminNotice">Nenhum lead encontrado.</p> : <div className="adminTableWrap"><table className="adminTable leadTable"><thead><tr><th>Lead</th><th>Embaixador</th><th>Status</th><th>Tentativas</th><th>IDs DataCrazy</th><th>Última tentativa</th><th>Ação</th></tr></thead><tbody>{items.map((lead) => <tr key={lead.id}><td><b>{lead.name}</b><small>{lead.establishment}<br />{date(lead.created_at)}</small></td><td>{lead.ambassador_name || "—"}<small>/{lead.ambassador_slug || "—"}</small></td><td><span className={`status status-${lead.crm_status}`}>{labels[lead.crm_status]}</span>{lead.crm_last_error && <small title={lead.crm_last_error}>{lead.crm_last_error}</small>}</td><td>{lead.crm_attempts}</td><td><small>Lead: {lead.datacrazy_lead_id || "—"}<br />Negócio: {lead.datacrazy_business_id || "—"}</small></td><td>{date(lead.crm_last_attempt_at)}{lead.crm_next_retry_at && <small>Próxima: {date(lead.crm_next_retry_at)}</small>}</td><td>{lead.crm_status !== "synced" && lead.crm_status !== "processing" ? <button onClick={() => void retry(lead.id)}>Tentar novamente</button> : "—"}</td></tr>)}</tbody></table></div>}
  </div></main>;
}
