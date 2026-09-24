-- Reviewed for the existing linked database; non-destructive application authorized.
-- Additive, legacy inserts keep working, no rows are deleted or rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.leads
  alter column ambassador_id drop not null,
  add column source_type text not null default 'ambassador' check (source_type in ('ambassador', 'institutional')),
  add column source_name text,
  add column intent text check (intent in ('gestao', 'operacao', 'delivery', 'migracao')),
  add column attribution jsonb;
alter table public.leads add constraint leads_source_identity_check check (
  (source_type = 'ambassador' and ambassador_id is not null) or
  (source_type = 'institutional' and ambassador_id is null)
);
create index leads_acquisition_idx on public.leads(source_type, source_name, intent, created_at desc);
comment on column public.leads.attribution is 'Session first touch and conversion touch, original bounded campaign parameters, landing URL and referrer.';
commit;
