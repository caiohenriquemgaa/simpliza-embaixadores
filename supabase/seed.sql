begin;

do $$
begin
  if to_regclass('public.ambassadors') is null
    or to_regclass('public.benefits') is null
    or to_regclass('public.testimonials') is null
    or to_regclass('public.faqs') is null
    or to_regclass('public.leads') is null then
    raise exception 'Seed cancelado: aplique as migrations antes do seed.';
  end if;

  if exists (select 1 from public.ambassadors)
    or exists (select 1 from public.benefits)
    or exists (select 1 from public.testimonials)
    or exists (select 1 from public.faqs)
    or exists (select 1 from public.leads) then
    raise exception 'Seed cancelado: o banco não está vazio.';
  end if;
end
$$;

insert into public.ambassadors (
  id, name, slug, short_description, biography, hero_title, hero_subtitle, hero_quote,
  pain_title, solution_title, primary_cta_text, primary_cta_url, secondary_cta_text,
  secondary_cta_url, campaign_code, seo_title, seo_description, status, published_at
) values (
  '00000000-0000-4000-8000-000000000001', 'Felipe', 'felipe', 'Embaixador Simpliza',
  'Felipe indica o Simpliza para restaurantes que querem profissionalizar a gestão.',
  'Gestão de restaurante não precisa ser complicada.',
  'Controle vendas, estoque, CMV, financeiro e delivery em uma operação integrada com o Simpliza.',
  'Minha indicação para quem quer profissionalizar a gestão do restaurante.',
  'Seu restaurante vende. Mas você realmente sabe onde ganha e onde perde dinheiro?',
  'Uma operação integrada. Do pedido à gestão.', 'Quero conhecer o Simpliza', '#contato',
  'Ver como funciona em 90 segundos', '#demonstracao', 'embaixador-felipe',
  'Simpliza para Restaurantes | Indicação do Felipe',
  'Controle vendas, estoque, CMV, financeiro e delivery em uma operação integrada com o sistema de gestão Simpliza.',
  'published', now()
) on conflict (id) do nothing;

insert into public.benefits (ambassador_id, title, body, sort_order) values
('00000000-0000-4000-8000-000000000001', 'CMV no controle', 'Clareza sobre o custo real de cada venda.', 0),
('00000000-0000-4000-8000-000000000001', 'Estoque organizado', 'Compras e perdas apoiadas por dados confiáveis.', 1),
('00000000-0000-4000-8000-000000000001', 'Financeiro integrado', 'Números reunidos em uma única operação.', 2),
('00000000-0000-4000-8000-000000000001', 'Pedidos centralizados', 'Canais conectados à operação.', 3);

commit;
