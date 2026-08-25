create extension if not exists pgcrypto;

create type public.ambassador_status as enum ('draft', 'published', 'archived');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'discarded');

create table public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null default '', biography text not null default '',
  primary_photo_url text not null default '', secondary_photo_url text not null default '',
  instagram_url text not null default '', tiktok_url text not null default '',
  youtube_url text not null default '', whatsapp text not null default '',
  hero_title text not null, hero_subtitle text not null, hero_quote text not null default '',
  pain_title text not null, solution_title text not null, testimonial text not null default '',
  primary_cta_text text not null, primary_cta_url text not null default '#contato',
  secondary_cta_text text not null, secondary_cta_url text not null default '#demonstracao',
  campaign_code text not null default '', seo_title text not null, seo_description text not null,
  og_image_url text not null default '', video_url text not null default '',
  status public.ambassador_status not null default 'draft', published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.benefits (
  id uuid primary key default gen_random_uuid(), ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  title text not null, body text not null, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.testimonials (
  id uuid primary key default gen_random_uuid(), ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  title text not null default '', body text not null, author text not null default '', role text not null default '',
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.faqs (
  id uuid primary key default gen_random_uuid(), ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  question text not null, answer text not null, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.leads (
  id uuid primary key default gen_random_uuid(), name text not null, phone text not null, email text,
  establishment text not null, city text, ambassador_id uuid not null references public.ambassadors(id),
  source_page text not null, monthly_revenue text, utm_source text, utm_medium text, utm_campaign text,
  utm_content text, utm_term text, consent_lgpd boolean not null check (consent_lgpd),
  status public.lead_status not null default 'new', created_at timestamptz not null default now()
);

create index ambassadors_public_idx on public.ambassadors(status, slug);
create index benefits_order_idx on public.benefits(ambassador_id, sort_order);
create index testimonials_order_idx on public.testimonials(ambassador_id, sort_order);
create index faqs_order_idx on public.faqs(ambassador_id, sort_order);
create index leads_ambassador_created_idx on public.leads(ambassador_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger ambassadors_updated before update on public.ambassadors for each row execute function public.set_updated_at();
create trigger benefits_updated before update on public.benefits for each row execute function public.set_updated_at();
create trigger testimonials_updated before update on public.testimonials for each row execute function public.set_updated_at();
create trigger faqs_updated before update on public.faqs for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

alter table public.ambassadors enable row level security;
alter table public.benefits enable row level security;
alter table public.testimonials enable row level security;
alter table public.faqs enable row level security;
alter table public.leads enable row level security;

create policy "published ambassadors are public" on public.ambassadors for select using (status = 'published' or public.is_admin());
create policy "admins manage ambassadors" on public.ambassadors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "published benefits are public" on public.benefits for select using (exists (select 1 from public.ambassadors a where a.id = ambassador_id and (a.status = 'published' or public.is_admin())));
create policy "admins manage benefits" on public.benefits for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "published testimonials are public" on public.testimonials for select using (exists (select 1 from public.ambassadors a where a.id = ambassador_id and (a.status = 'published' or public.is_admin())));
create policy "admins manage testimonials" on public.testimonials for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "published faqs are public" on public.faqs for select using (exists (select 1 from public.ambassadors a where a.id = ambassador_id and (a.status = 'published' or public.is_admin())));
create policy "admins manage faqs" on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read leads" on public.leads for select to authenticated using (public.is_admin());
create policy "admins manage leads" on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('ambassador-assets', 'ambassador-assets', true)
on conflict (id) do update set public = excluded.public;
create policy "ambassador assets are public" on storage.objects for select using (bucket_id = 'ambassador-assets');
create policy "admins upload ambassador assets" on storage.objects for insert to authenticated with check (bucket_id = 'ambassador-assets' and public.is_admin());
create policy "admins update ambassador assets" on storage.objects for update to authenticated using (bucket_id = 'ambassador-assets' and public.is_admin());
create policy "admins delete ambassador assets" on storage.objects for delete to authenticated using (bucket_id = 'ambassador-assets' and public.is_admin());
