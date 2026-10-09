-- =====================================================================
-- CHAT: REAÇÕES COM EMOJI + PAINEL INICIA CONVERSA - Kanandzika
-- Cole no Supabase: SQL Editor > New query > Run  (pode correr mais de uma vez)
-- Requer o chat.sql já corrido.
-- =====================================================================

-- 1) Reações (uma por mensagem e por lado: cliente / suporte)
create table if not exists public.chat_reacoes (
  id         bigint generated always as identity primary key,
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  user_id    uuid   not null,                       -- dono da conversa
  autor      text   not null check (autor in ('cliente','suporte')),
  emoji      text   not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (message_id, autor)
);
create index if not exists chat_reacoes_user_idx on public.chat_reacoes (user_id);
alter table public.chat_reacoes enable row level security;

drop policy if exists "cliente le reacoes"      on public.chat_reacoes;
drop policy if exists "cliente reage"           on public.chat_reacoes;
drop policy if exists "cliente muda reacao"     on public.chat_reacoes;
drop policy if exists "cliente apaga reacao"    on public.chat_reacoes;
drop policy if exists "admin gere reacoes"      on public.chat_reacoes;

create policy "cliente le reacoes" on public.chat_reacoes
  for select to authenticated using (user_id = auth.uid());
create policy "cliente reage" on public.chat_reacoes
  for insert to authenticated with check (
    user_id = auth.uid() and autor = 'cliente'
    and exists (select 1 from public.chat_messages m where m.id = message_id and m.user_id = auth.uid()));
create policy "cliente muda reacao" on public.chat_reacoes
  for update to authenticated
  using (user_id = auth.uid() and autor = 'cliente')
  with check (user_id = auth.uid() and autor = 'cliente');
create policy "cliente apaga reacao" on public.chat_reacoes
  for delete to authenticated using (user_id = auth.uid() and autor = 'cliente');
create policy "admin gere reacoes" on public.chat_reacoes
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2) O painel descobre o utilizador a partir do telemóvel (para abrir conversa nova)
create or replace function public.admin_user_id(p text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users
  where (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and email = p || '@kanandzika.app'
  limit 1
$$;
revoke all on function public.admin_user_id(text) from public, anon;
grant execute on function public.admin_user_id(text) to authenticated;

-- 3) Tempo real
do $$
begin
  begin alter publication supabase_realtime add table public.chat_reacoes; exception when duplicate_object then null; end;
end $$;
