"use client";

import { useState } from "react";
import styles from "./plan-simulator.module.css";

type Plan = { revenue: string; name: string; description: string; monthly: number; annual: number; warning?: string };

const plans: readonly Plan[] = [
  { revenue: "R$ 20 mil", name: "Plano Start", description: "Para quem está começando e precisa de gestão básica e eficiente.", monthly: 149, annual: 99, warning: "Este plano NÃO emite Nota Fiscal" },
  { revenue: "R$ 40 mil", name: "Plano Essencial", description: "Ideal para negócios em fase inicial que buscam organização e controle.", monthly: 229, annual: 185 },
  { revenue: "R$ 70 mil", name: "Plano Gestão", description: "Ideal para negócios em crescimento que precisam de controle total e agilidade.", monthly: 319, annual: 250 },
  { revenue: "R$ 200 mil", name: "Plano Profissional", description: "Perfeito para operações consolidadas que demandam automação e integrações.", monthly: 439, annual: 350 },
  { revenue: "R$ 500 mil", name: "Plano Corporativo", description: "A solução completa para redes e franquias com gestão multi-unidades.", monthly: 525, annual: 420 },
] as const;

export function PlanSimulator() {
  const [planIndex, setPlanIndex] = useState(1);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const plan = plans[planIndex];
  const price = billing === "annual" ? plan.annual : plan.monthly;

  return <section className={`section ${styles.planSection}`} id="simulador">
    <div className={styles.planIntro}>
      <div className="eyebrow"><i/>Plano ideal</div>
      <h2>Simule o plano ideal para o seu restaurante</h2>
      <p>Informe o faturamento médio mensal e veja a opção mais adequada para a sua operação.</p>
    </div>
    <div className={styles.billingSwitch} role="group" aria-label="Forma de cobrança">
      <button type="button" className={billing === "monthly" ? styles.active : ""} onClick={() => setBilling("monthly")} aria-pressed={billing === "monthly"}>Mensal</button>
      <button type="button" className={billing === "annual" ? styles.active : ""} onClick={() => setBilling("annual")} aria-pressed={billing === "annual"}>Anual <small>Até 20% OFF</small></button>
    </div>
    <div className={styles.planSimulator}>
      <label htmlFor="plan-revenue">Faturamento médio mensal do restaurante</label>
      <input id="plan-revenue" type="range" min="0" max="4" step="1" value={planIndex} onChange={event => setPlanIndex(Number(event.target.value))} aria-valuetext={plan.revenue}/>
      <div className={styles.revenueMarks} aria-hidden="true">{plans.map((item, index) => <button type="button" className={index === planIndex ? styles.active : ""} onClick={() => setPlanIndex(index)} key={item.revenue} tabIndex={-1}>{item.revenue}</button>)}</div>
      <article className={styles.planCard} aria-live="polite">
        {plan.warning && <p className={styles.planWarning}>⚠ {plan.warning}</p>}
        <h3>{plan.name}</h3>
        <p>{plan.description}</p>
        <div className={styles.planPrice}><strong>R${price}</strong><span>/mês</span><small>{billing === "annual" ? "Cobrado anualmente" : "Implantação: R$ 300,00"}</small>{billing === "annual" && <b>✓ Implantação Grátis</b>}</div>
        <a className={styles.planDetails} href="https://simpliza.com.br/precos-planos.php" target="_blank" rel="noreferrer">Veja o que está incluso no sistema</a>
        <p className={styles.planTerms}>{billing === "annual" ? "Pagamento à vista ou em até 12x no cartão de crédito." : "Prazo mínimo de 90 dias — cancelamento livre nos primeiros 30."}</p>
      </article>
      <a className={styles.planCta} href="#contato">Quero conhecer o {plan.name}</a>
    </div>
  </section>;
}
