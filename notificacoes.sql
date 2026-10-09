-- =====================================================================
-- NOTIFICAÇÕES DO PAINEL PARA O APP - Kanandzika
-- Cole no Supabase: SQL Editor > New query > Run  (pode correr mais de uma vez)
-- =====================================================================

create table if not exists public.notificacoes (
  id         bigint generated always as identity primary key,
  phone      text,                       -- 9 dígitos do cliente; NULL = todos os clientes
  nome       text,                       -- nome do destinatário (só para o histórico do painel)
  titulo     text not null check (char_length(titulo)  between 1 and 150),
  mensagem   text not null check (char_length(mensagem) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists notificacoes_phone_idx on public.notificacoes (phone, id desc);
alter table public.notificacoes enable row level security;

drop policy if exists "cliente le as suas notificacoes" on public.notificacoes;
drop policy if exists "admin gere notificacoes"         on public.notificacoes;

-- O cliente (login = <telemóvel>@kanandzika.app) lê as suas e as enviadas a todos
create policy "cliente le as suas notificacoes" on public.notificacoes
  for select to authenticated
  using (phone is null or phone = split_part(auth.jwt() ->> 'email', '@', 1));

create policy "admin gere notificacoes" on public.notificacoes
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Tempo real
do $$
begin
  begin alter publication supabase_realtime add table public.notificacoes; exception when duplicate_object then null; end;
end $$;
