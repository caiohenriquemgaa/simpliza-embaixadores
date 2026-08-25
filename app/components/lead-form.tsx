"use client";

import { FormEvent, useRef, useState } from "react";
import { readJsonResponse } from "@/lib/http";
import { Icon } from "./brand-icon";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    fbq?: (action: string, event: string, data?: Record<string, unknown>) => void;
  }
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type Props = { ambassadorId: string; ambassadorName: string; ambassadorSlug: string; campaignCode: string };

export function LeadForm({ ambassadorId, ambassadorName, ambassadorSlug, campaignCode }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [startedAt] = useState(() => Date.now());
  const requestId = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    requestId.current ??= crypto.randomUUID();
    const payload = {
      name: form.get("name"), phone, email: form.get("email"),
      establishment: form.get("establishment"), city: form.get("city"),
      monthlyRevenue: form.get("monthlyRevenue"), contactPreference: form.get("contactPreference"),
      ambassadorId, ambassadorName, ambassadorSlug, campaignCode,
      sourcePage: window.location.pathname, sourceUrl: window.location.href,
      consentLgpd: form.get("consent") === "on", submittedAt: new Date().toISOString(),
      website: form.get("website"), formStartedAt: startedAt,
      utmSource: params.get("utm_source") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      utmContent: params.get("utm_content") ?? undefined,
      utmTerm: params.get("utm_term") ?? undefined,
    };
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": requestId.current },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok || !result) throw new Error(result?.error || "Não foi possível enviar seus dados.");
      requestId.current = null;
      setStatus("sent");
      window.dataLayer?.push({ event: "generate_lead", ambassador: ambassadorSlug, campaign: campaignCode });
      window.fbq?.("track", "Lead", { ambassador: ambassadorSlug, campaign: campaignCode });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar seus dados.");
    }
  }

  if (status === "sent") return <form><div className="success" role="status"><span><Icon name="check" /></span><h3>Interesse registrado!</h3><p>Recebemos seus dados. Um especialista da Simpliza entrará em contato.</p><button type="button" onClick={() => setStatus("idle")}>Enviar outro contato</button></div></form>;

  return <form onSubmit={submit} aria-busy={status === "sending"}>
    <div className="formHead"><b>Fale com um especialista</b><small>Preencha em menos de 1 minuto</small></div>
    <label>Nome<input name="name" required minLength={2} autoComplete="name" placeholder="Como podemos te chamar?" /></label>
    <label>WhatsApp<input name="phone" required inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} pattern="\(\d{2}\) \d{4,5}-\d{4}" placeholder="(00) 00000-0000" /></label>
    <label>Nome do restaurante<input name="establishment" required minLength={2} autoComplete="organization" placeholder="Nome do seu negócio" /></label>
    <div className="formRow"><label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@email.com" /></label><label>Cidade<input name="city" autoComplete="address-level2" placeholder="Sua cidade" /></label></div>
    <div className="formRow"><label>Faturamento mensal<select name="monthlyRevenue" defaultValue=""><option value="">Prefiro não informar</option><option>Até R$ 30 mil</option><option>R$ 30 a 80 mil</option><option>R$ 80 a 200 mil</option><option>Acima de R$ 200 mil</option></select></label><label>Prefere contato por<select name="contactPreference" defaultValue="whatsapp"><option value="whatsapp">WhatsApp</option><option value="phone">Ligação</option><option value="email">E-mail</option></select></label></div>
    <label className="honeypot" aria-hidden="true">Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <label className="consent"><input name="consent" required type="checkbox" /><span>Concordo em receber contato da Simpliza e declaro estar ciente da Política de Privacidade.</span></label>
    {status === "error" && <p className="formError" role="alert">{message}</p>}
    <button disabled={status === "sending"} className="btn primary formBtn">{status === "sending" ? "Enviando..." : "Quero conhecer o Simpliza"}<Icon name="arrow" /></button>
    <p className="safe">Seus dados estão seguros com a gente.</p>
  </form>;
}
