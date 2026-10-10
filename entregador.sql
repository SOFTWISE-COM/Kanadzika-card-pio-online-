-- =====================================================================
-- ENTREGADORES - Kanandzika
-- Cole no Supabase: SQL Editor > New query > Run  (pode correr mais de uma vez)
-- Requer já corridos: rastreio.sql, painel.sql, faturacao.sql, push.sql
--
-- O que isto cria:
--  * drivers          -> conta de entregador (precisa de ser aprovada no painel)
--  * orders           -> colunas novas: driver_id, driver_stage, ganho, ...
--  * driver_trail     -> trajeto (pontos GPS) do entregador, para o painel
--  * driver_messages  -> mensagens do painel para o entregador (e respostas)
--  * funções          -> aceitar pedido, mudar de etapa, enviar posição, etc.
-- =====================================================================

-- Ganho do entregador por entrega (MT). Para mudar o valor, altere aqui e corra de novo.
create or replace function public.entregador_ganho() returns numeric
language sql immutable as $$ select 50::numeric $$;

-- ---------------------------------------------------------------------
-- 1) Contas de entregador
-- ---------------------------------------------------------------------
create table if not exists public.drivers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text,
  phone      text,
  avatar     text,
  vehicle    text not null default 'Moto',
  plate      text,
  status     text not null default 'pendente' check (status in ('pendente','aprovado','bloqueado')),
  online     boolean not null default false,
  lat        double precision,
  lng        double precision,
  heading    double precision,
  speed      double precision,
  loc_at     timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists drivers_status_idx on public.drivers (status, online);
alter table public.drivers enable row level security;

drop policy if exists "entregador le a propria conta" on public.drivers;
drop policy if exists "admin gere entregadores"       on public.drivers;
create policy "entregador le a propria conta" on public.drivers
  for select to authenticated using (user_id = auth.uid());
create policy "admin gere entregadores" on public.drivers
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- (O entregador NUNCA escreve direto na tabela: só pelas funções abaixo,
--  assim ninguém consegue aprovar-se a si próprio.)

-- Verdadeiro se quem chama é um entregador aprovado
create or replace function public.is_driver() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.drivers where user_id = auth.uid() and status = 'aprovado')
$$;
grant execute on function public.is_driver() to authenticated;

-- Pedir acesso de entregador (fica "pendente" até o dono aprovar no painel)
create or replace function public.entregador_registar(p_name text, p_phone text, p_vehicle text, p_plate text, p_avatar text)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  insert into public.drivers (user_id, name, phone, vehicle, plate, avatar)
  values (auth.uid(), left(coalesce(p_name,''),80), regexp_replace(coalesce(p_phone,''),'\D','','g'),
          left(coalesce(nullif(p_vehicle,''),'Moto'),30), left(coalesce(p_plate,''),20), left(coalesce(p_avatar,''),500))
  on conflict (user_id) do update
    set name = excluded.name, phone = excluded.phone, vehicle = excluded.vehicle,
        plate = excluded.plate, avatar = coalesce(nullif(excluded.avatar,''), public.drivers.avatar);
  select status into v_status from public.drivers where user_id = auth.uid();
  return v_status;
end $$;
revoke all on function public.entregador_registar(text,text,text,text,text) from public, anon;
grant execute on function public.entregador_registar(text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Pedidos: quem entrega e em que etapa está
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists driver_id    uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists driver_stage text;          -- aceite | na_loja | a_caminho | entregue
alter table public.orders add column if not exists driver_at    timestamptz;   -- quando aceitou
alter table public.orders add column if not exists picked_at    timestamptz;   -- quando levantou na lanchonete
alter table public.orders add column if not exists ganho        numeric not null default 0;
alter table public.orders add column if not exists notificado   boolean not null default false;
create index if not exists orders_driver_idx on public.orders (driver_id, driver_stage);

-- O entregador aprovado vê: pedidos Delivery livres (por entregar) e os seus
drop policy if exists "entregador ve pedidos" on public.orders;
create policy "entregador ve pedidos" on public.orders
  for select to authenticated using (
    public.is_driver() and (
      driver_id = auth.uid()
      or (type = 'Delivery' and driver_id is null and coalesce(entregue,false) = false)
    )
  );

-- O entregador vê a localização que o cliente partilha (dos pedidos livres ou seus)
drop policy if exists "entregador ve rastreio" on public.order_tracking;
create policy "entregador ve rastreio" on public.order_tracking
  for select to authenticated using (
    public.is_driver() and exists (
      select 1 from public.orders o
      where o.track_id = order_tracking.track_id
        and (o.driver_id = auth.uid() or (o.driver_id is null and coalesce(o.entregue,false) = false))
    )
  );

-- ---------------------------------------------------------------------
-- 3) Funções do entregador
-- ---------------------------------------------------------------------
-- Aceitar um pedido (só um entregador consegue; só 1 entrega ativa de cada vez)
create or replace function public.entregador_aceitar(p_order bigint) returns json
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  if exists (select 1 from public.orders where driver_id = auth.uid() and driver_stage in ('aceite','na_loja','a_caminho')) then
    return json_build_object('ok', false, 'erro', 'ja_ativa');
  end if;
  update public.orders
     set driver_id = auth.uid(), driver_stage = 'aceite', driver_at = now()
   where id = p_order and type = 'Delivery' and driver_id is null and coalesce(entregue,false) = false
   returning id into v_id;
  if v_id is null then return json_build_object('ok', false, 'erro', 'indisponivel'); end if;
  return json_build_object('ok', true);
end $$;
revoke all on function public.entregador_aceitar(bigint) from public, anon;
grant execute on function public.entregador_aceitar(bigint) to authenticated;

-- Mudar de etapa: na_loja -> a_caminho (levantou o pedido) -> entregue ; ou libertar (desistir antes de levantar)
create or replace function public.entregador_etapa(p_order bigint, p_etapa text) returns json
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  select * into o from public.orders where id = p_order and driver_id = auth.uid() for update;
  if not found then return json_build_object('ok', false, 'erro', 'nao_e_seu'); end if;

  if p_etapa = 'na_loja' and o.driver_stage = 'aceite' then
    update public.orders set driver_stage = 'na_loja' where id = o.id;
  elsif p_etapa = 'a_caminho' and o.driver_stage in ('aceite','na_loja') then
    update public.orders set driver_stage = 'a_caminho', picked_at = now() where id = o.id;
  elsif p_etapa = 'entregue' and o.driver_stage = 'a_caminho' then
    update public.orders
       set driver_stage = 'entregue', entregue = true, entregue_em = now(), ganho = public.entregador_ganho()
     where id = o.id;
    if o.track_id is not null then
      update public.order_tracking set status = 'encerrado' where track_id = o.track_id;
      delete from public.driver_location where track_id = o.track_id;
    end if;
  elsif p_etapa = 'libertar' and o.driver_stage in ('aceite','na_loja') then
    update public.orders set driver_id = null, driver_stage = null, driver_at = null where id = o.id;
  else
    return json_build_object('ok', false, 'erro', 'etapa_invalida');
  end if;
  return json_build_object('ok', true);
end $$;
revoke all on function public.entregador_etapa(bigint,text) from public, anon;
grant execute on function public.entregador_etapa(bigint,text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) Trajeto (pontos GPS) e posição ao vivo
-- ---------------------------------------------------------------------
create table if not exists public.driver_trail (
  id        bigint generated always as identity primary key,
  driver_id uuid not null references auth.users(id) on delete cascade,
  order_id  bigint,
  lat       double precision not null,
  lng       double precision not null,
  speed     double precision,
  at        timestamptz not null default now()
);
create index if not exists driver_trail_idx on public.driver_trail (driver_id, at desc);
alter table public.driver_trail enable row level security;

drop policy if exists "entregador le o seu trajeto" on public.driver_trail;
drop policy if exists "admin gere trajetos"         on public.driver_trail;
create policy "entregador le o seu trajeto" on public.driver_trail
  for select to authenticated using (driver_id = auth.uid());
create policy "admin gere trajetos" on public.driver_trail
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- O app do entregador chama isto de poucos em poucos segundos enquanto está online.
-- Atualiza a posição; se há entrega ativa a caminho do cliente, o cliente vê a moto no mapa.
create or replace function public.entregador_ping(p_lat double precision, p_lng double precision,
  p_heading double precision default null, p_speed double precision default null, p_trail boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_track uuid; v_order bigint; v_stage text;
begin
  update public.drivers
     set lat = p_lat, lng = p_lng, heading = p_heading, speed = p_speed, loc_at = now(), online = true
   where user_id = auth.uid() and status = 'aprovado';
  if not found then return; end if;

  select id, track_id, driver_stage into v_order, v_track, v_stage
    from public.orders
   where driver_id = auth.uid() and driver_stage in ('aceite','na_loja','a_caminho')
   limit 1;

  if v_stage = 'a_caminho' and v_track is not null then
    insert into public.driver_location (track_id, lat, lng, heading, speed, updated_at)
    values (v_track, p_lat, p_lng, p_heading, p_speed, now())
    on conflict (track_id) do update
      set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading,
          speed = excluded.speed, updated_at = excluded.updated_at;
  end if;

  if p_trail then
    insert into public.driver_trail (driver_id, order_id, lat, lng, speed) values (auth.uid(), v_order, p_lat, p_lng, p_speed);
  end if;
end $$;
revoke all on function public.entregador_ping(double precision,double precision,double precision,double precision,boolean) from public, anon;
grant execute on function public.entregador_ping(double precision,double precision,double precision,double precision,boolean) to authenticated;

-- Ficar online / offline
create or replace function public.entregador_online(p_online boolean) returns void
language sql security definer set search_path = public as $$
  update public.drivers set online = p_online where user_id = auth.uid() and status = 'aprovado'
$$;
revoke all on function public.entregador_online(boolean) from public, anon;
grant execute on function public.entregador_online(boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Mensagens painel <-> entregador
-- ---------------------------------------------------------------------
create table if not exists public.driver_messages (
  id         bigint generated always as identity primary key,
  driver_id  uuid not null references auth.users(id) on delete cascade,
  sender     text not null check (sender in ('admin','entregador')),
  message    text not null check (char_length(message) between 1 and 1000),
  lida       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists driver_messages_idx on public.driver_messages (driver_id, created_at);
alter table public.driver_messages enable row level security;

drop policy if exists "entregador le as suas mensagens"   on public.driver_messages;
drop policy if exists "entregador envia mensagem"         on public.driver_messages;
drop policy if exists "admin gere mensagens de entregador" on public.driver_messages;
create policy "entregador le as suas mensagens" on public.driver_messages
  for select to authenticated using (driver_id = auth.uid());
create policy "entregador envia mensagem" on public.driver_messages
  for insert to authenticated with check (driver_id = auth.uid() and sender = 'entregador' and public.is_driver());
create policy "admin gere mensagens de entregador" on public.driver_messages
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Marca como lidas as mensagens do painel (chamado quando o entregador abre a conversa)
create or replace function public.entregador_ler_mensagens() returns void
language sql security definer set search_path = public as $$
  update public.driver_messages set lida = true where driver_id = auth.uid() and sender = 'admin' and lida = false
$$;
revoke all on function public.entregador_ler_mensagens() from public, anon;
grant execute on function public.entregador_ler_mensagens() to authenticated;

-- ---------------------------------------------------------------------
-- 6) Tempo real
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.drivers;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.driver_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.orders;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.order_tracking;  exception when duplicate_object then null; end;
end $$;

-- OPCIONAL (limpeza): apagar trajetos com mais de 14 dias
-- delete from public.driver_trail where at < now() - interval '14 days';
