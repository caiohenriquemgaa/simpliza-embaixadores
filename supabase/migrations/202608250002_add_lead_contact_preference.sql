update public.leads
set contact_preference = 'whatsapp'
where contact_preference is null;

alter table public.leads
  alter column contact_preference set not null;

alter table public.leads
  add constraint leads_contact_preference_check
  check (contact_preference in ('whatsapp', 'phone_call', 'email'));
