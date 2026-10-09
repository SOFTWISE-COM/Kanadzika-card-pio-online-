-- =====================================================================
-- PAINEL COMPLETO - Kanandzika (feedback, apagar histórico, avisos em tempo real)
-- Cole no Supabase: SQL Editor > New query > Run  (pode correr mais de uma vez)
-- =====================================================================

-- 1) Tabela de feedback dos clientes
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid(),
  name       text,
  phone      text,
  rating     int  not null check (rating between 1 and 5),
  message    text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

drop policy if exists "cliente envia feedback" on public.feedback;
drop policy if exists "admin gere feedback"    on public.feedback;
create policy "cliente envia feedback" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
create policy "admin gere feedback" on public.feedback
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2) O admin pode apagar pedidos (histórico)
drop policy if exists "admin apaga pedidos" on public.orders;
create policy "admin apaga pedidos" on public.orders
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 3) Avisos em tempo real (novo cadastro, novo pedido, novo feedback)
do $$
begin
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.orders;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.feedback; exception when duplicate_object then null; end;
end $$;
