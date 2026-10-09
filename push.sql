-- =====================================================================
-- NOTIFICAÇÕES PUSH NO TELEMÓVEL (barra de notificações) - Kanandzika
-- Cole no Supabase: SQL Editor > New query > Run  (pode correr mais de uma vez)
-- =====================================================================

create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null,
  phone      text,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_phone_idx on public.push_subs (phone);

-- Sem políticas: ninguém lê esta tabela pelo site. Só o servidor (chave de serviço).
alter table public.push_subs enable row level security;

-- O app regista o telemóvel através desta função (segura, associa ao utilizador com sessão)
create or replace function public.registar_push(p_endpoint text, p_p256dh text, p_auth text, p_phone text)
returns void language sql security definer set search_path = public as $$
  insert into public.push_subs (endpoint, user_id, phone, p256dh, auth)
  values (p_endpoint, auth.uid(), p_phone, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, phone = excluded.phone,
        p256dh = excluded.p256dh, auth = excluded.auth
$$;
revoke all on function public.registar_push(text,text,text,text) from public, anon;
grant execute on function public.registar_push(text,text,text,text) to authenticated;
