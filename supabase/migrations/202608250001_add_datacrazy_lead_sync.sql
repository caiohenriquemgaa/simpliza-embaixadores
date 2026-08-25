do $$ begin
  create type public.crm_sync_status as enum ('pending', 'processing', 'synced', 'failed');
exception
  when duplicate_object then null;
end $$;

alter table public.leads
  add column if not exists crm_status public.crm_sync_status not null default 'pending',
  add column if not exists datacrazy_lead_id text,
  add column if not exists datacrazy_business_id text,
  add column if not exists crm_attempts integer not null default 0 check (crm_attempts >= 0),
  add column if not exists crm_last_error text,
  add column if not exists crm_last_attempt_at timestamptz,
  add column if not exists crm_synced_at timestamptz,
  add column if not exists crm_next_retry_at timestamptz,
  add column if not exists crm_external_id uuid,
  add column if not exists client_request_id uuid,
  add column if not exists ambassador_slug text,
  add column if not exists ambassador_name text,
  add column if not exists campaign_code text,
  add column if not exists source_url text,
  add column if not exists phone_normalized text,
  add column if not exists contact_preference text,
  add column if not exists consent_at timestamptz;

update public.leads l
set ambassador_slug = coalesce(l.ambassador_slug, a.slug),
    ambassador_name = coalesce(l.ambassador_name, a.name),
    campaign_code = coalesce(l.campaign_code, a.campaign_code),
    crm_external_id = coalesce(l.crm_external_id, l.id),
    consent_at = coalesce(l.consent_at, l.created_at)
from public.ambassadors a
where a.id = l.ambassador_id
  and (l.ambassador_slug is null or l.ambassador_name is null or l.campaign_code is null
    or l.crm_external_id is null or l.consent_at is null);

alter table public.leads
  alter column crm_external_id set not null,
  alter column consent_at set default now(),
  alter column consent_at set not null;

create unique index if not exists leads_crm_external_id_unique on public.leads(crm_external_id);
create unique index if not exists leads_client_request_id_unique on public.leads(client_request_id) where client_request_id is not null;
create index if not exists leads_crm_retry_idx on public.leads(crm_status, crm_next_retry_at, created_at);
create index if not exists leads_recent_opportunity_idx on public.leads(ambassador_id, phone_normalized, created_at desc);

create or replace function public.set_lead_crm_external_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.crm_external_id = coalesce(new.crm_external_id, new.id);
  return new;
end;
$$;

drop trigger if exists leads_set_crm_external_id on public.leads;
create trigger leads_set_crm_external_id
before insert on public.leads
for each row execute function public.set_lead_crm_external_id();

create or replace function public.claim_lead_for_crm(p_lead_id uuid default null)
returns setof public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_id uuid;
begin
  select l.id into selected_id
  from public.leads l
  where (p_lead_id is null or l.id = p_lead_id)
    and (
      l.crm_status = 'pending'
      or (l.crm_status = 'failed' and coalesce(l.crm_next_retry_at, now()) <= now())
      or (l.crm_status = 'processing' and l.crm_last_attempt_at < now() - interval '10 minutes')
    )
  order by l.created_at
  for update skip locked
  limit 1;

  if selected_id is null then
    return;
  end if;

  return query
  update public.leads
  set crm_status = 'processing',
      crm_attempts = crm_attempts + 1,
      crm_last_attempt_at = now(),
      crm_last_error = null
  where id = selected_id
  returning *;
end;
$$;

revoke all on function public.claim_lead_for_crm(uuid) from public, anon, authenticated;
grant execute on function public.claim_lead_for_crm(uuid) to service_role;

comment on column public.leads.crm_external_id is 'ID idempotente enviado ao DataCrazy; igual ao UUID local do lead para novos registros.';
comment on column public.leads.client_request_id is 'Chave técnica gerada pelo navegador para impedir inserções repetidas da mesma submissão.';
comment on function public.claim_lead_for_crm(uuid) is 'Reserva atomicamente um lead elegível para sincronização, inclusive processamentos abandonados há 10 minutos.';
