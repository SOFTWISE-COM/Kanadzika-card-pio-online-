-- =====================================================================
-- RASTREIO DE ENTREGAS EM TEMPO REAL - Kanandzika
-- Cole tudo isto no Supabase: SQL Editor > New query > Run
-- (Pode correr mais de uma vez sem problema.)
-- =====================================================================

-- 1) Liga cada pedido ao seu rastreio
alter table public.orders add column if not exists track_id uuid;
create index if not exists orders_track_id_idx on public.orders (track_id);

-- 2) Localização do cliente + estado da entrega
create table if not exists public.order_tracking (
  track_id   uuid primary key,
  user_id    uuid not null default auth.uid(),
  cust_lat   double precision,
  cust_lng   double precision,
  cust_at    timestamptz,
  status     text not null default 'ativo' check (status in ('ativo','encerrado')),
  created_at timestamptz not null default now()
);

-- 3) Localização do entregador (uma linha por entrega, sempre a última posição)
create table if not exists public.driver_location (
  track_id   uuid primary key,
  lat        double precision not null,
  lng        double precision not null,
  heading    double precision,
  speed      double precision,
  updated_at timestamptz not null default now()
);

alter table public.order_tracking  enable row level security;
alter table public.driver_location enable row level security;

-- Admin = conta com app_metadata.role = 'admin' (a mesma que já usa no painel)
-- order_tracking
drop policy if exists "cliente le o proprio rastreio"      on public.order_tracking;
drop policy if exists "cliente cria o proprio rastreio"    on public.order_tracking;
drop policy if exists "cliente atualiza o proprio rastreio" on public.order_tracking;
drop policy if exists "admin gere rastreio"                on public.order_tracking;

create policy "cliente le o proprio rastreio" on public.order_tracking
  for select to authenticated using (user_id = auth.uid());
create policy "cliente cria o proprio rastreio" on public.order_tracking
  for insert to authenticated with check (user_id = auth.uid());
create policy "cliente atualiza o proprio rastreio" on public.order_tracking
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin gere rastreio" on public.order_tracking
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- driver_location
drop policy if exists "cliente ve o seu entregador" on public.driver_location;
drop policy if exists "admin gere posicao"          on public.driver_location;

create policy "cliente ve o seu entregador" on public.driver_location
  for select to authenticated using (
    exists (select 1 from public.order_tracking t
            where t.track_id = driver_location.track_id and t.user_id = auth.uid())
  );
create policy "admin gere posicao" on public.driver_location
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 4) Ativa o Realtime nas duas tabelas
do $$
begin
  begin alter publication supabase_realtime add table public.order_tracking;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.driver_location; exception when duplicate_object then null; end;
end $$;
