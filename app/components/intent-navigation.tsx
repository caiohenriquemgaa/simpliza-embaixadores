"use client";
import { useEffect, useRef } from "react";
import { readAttribution } from "@/lib/attribution";
import { Icon } from "./brand-icon";

const cards = [
  { id: "gestao", icon: "chart", title: "Gestão", text: "Estoque, financeiro, CMV e resultados." },
  { id: "operacao", icon: "order", title: "Operação", text: "PDV, comandas, cozinha e caixa." },
  { id: "delivery", icon: "order", title: "Delivery", text: "Pedidos e canais centralizados." },
  { id: "migracao", icon: "check", title: "Trocar de sistema", text: "Uma operação mais integrada com suporte." },
];
export function IntentNavigation() {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const { intent } = readAttribution();
    // Highlight without unexpected scrolling or changing the visitor's history.
    if (intent) navigation.current?.querySelector(`[href="#${intent}"]`)?.setAttribute("data-selected", "true");
  }, []);
  return <nav ref={navigation} className="section intentNavigation" aria-label="Encontre sua solução"><div className="intro"><h2>O que você precisa simplificar hoje?</h2></div><div className="intentGrid">{cards.map(card => <a key={card.id} href={`#${card.id}`}><span className="icon"><Icon name={card.icon}/></span><h3>{card.title}</h3><p>{card.text}</p><span className="intentLink">Ver solução <Icon name="arrow"/></span></a>)}</div></nav>;
}
