create table if not exists public.boigordo_lista (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  whatsapp text not null,
  created_at timestamptz not null default now()
);

create index if not exists boigordo_lista_created_at_idx
  on public.boigordo_lista (created_at desc);

create index if not exists boigordo_lista_email_idx
  on public.boigordo_lista (lower(email));
