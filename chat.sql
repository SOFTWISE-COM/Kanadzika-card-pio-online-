-- =====================================================================
-- CHAT DE SUPORTE - Kanandzika
-- Cole no Supabase: SQL Editor > New query > Run  (pode correr mais de uma vez)
-- =====================================================================

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid(),            -- o cliente dono da conversa
  sender     text not null check (sender in ('cliente','suporte','auto')),
  name       text,
  phone      text,
  message    text not null check (char_length(message) between 1 and 1000),
  lida_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at);
alter table public.chat_messages enable row level security;

drop policy if exists "cliente le a sua conversa"   on public.chat_messages;
drop policy if exists "cliente envia mensagem"      on public.chat_messages;
drop policy if exists "admin gere conversas"        on public.chat_messages;

create policy "cliente le a sua conversa" on public.chat_messages
  for select to authenticated using (user_id = auth.uid());
create policy "cliente envia mensagem" on public.chat_messages
  for insert to authenticated with check (user_id = auth.uid() and sender = 'cliente');
create policy "admin gere conversas" on public.chat_messages
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Resposta automática: quando o cliente escreve e nos últimos 30 minutos
-- ninguém (suporte ou automática) lhe respondeu, o sistema envia o aviso.
create or replace function public.chat_auto_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender = 'cliente' and not exists (
    select 1 from public.chat_messages m
    where m.user_id = new.user_id and m.sender in ('auto','suporte')
      and m.created_at > now() - interval '30 minutes'
  ) then
    insert into public.chat_messages (user_id, sender, name, phone, message, lida_admin)
    values (new.user_id, 'auto', 'Suporte Kanandzika', new.phone,
      'Recebemos a sua mensagem. Dentro de instantes receberá uma resposta da nossa equipa de suporte da Kanandzika Lanchonete Premium.',
      true);
  end if;
  return new;
end $$;

drop trigger if exists chat_auto_reply_trg on public.chat_messages;
create trigger chat_auto_reply_trg after insert on public.chat_messages
  for each row execute function public.chat_auto_reply();

-- Tempo real
do $$
begin
  begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end;
end $$;
