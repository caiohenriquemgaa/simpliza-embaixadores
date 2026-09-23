import type { Ambassador } from "./types";

export function ambassadorSeo(ambassador: Ambassador) {
  // Older editor defaults were copied from Felipe into other ambassador records.
  const copied = ambassador.slug !== "felipe" && /felipe/i.test(`${ambassador.seoTitle} ${ambassador.seoDescription}`);
  return {
    title: copied || !ambassador.seoTitle ? `Simpliza para Restaurantes | Indicação de ${ambassador.name}` : ambassador.seoTitle,
    description: copied || !ambassador.seoDescription ? `Conheça o Simpliza com ${ambassador.name}. PDV, estoque, financeiro e delivery conectados para simplificar a gestão do seu restaurante.` : ambassador.seoDescription,
  };
}
