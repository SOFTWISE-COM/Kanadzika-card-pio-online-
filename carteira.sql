-- =====================================================================
--  Kanandzika - CARTEIRA DO ENTREGADOR + COMISSÃO DA PLATAFORMA
--  Corra no Supabase (SQL Editor). Depende só do entregador.sql (já corrido). Pode correr mais de uma vez.
--
--  Como funciona:
--   * O cliente paga a taxa de entrega (70 a 170 MT, conforme a distância) e o entregador recebe-a.
--   * A plataforma fica com uma comissão FIXA de 20 MT por entrega.
--   * A comissão é descontada do SALDO pré-pago do entregador, ao concluir a entrega.
--   * O entregador carrega saldo por M-Pesa 847923879 ou e-Mola 878472879 e envia o
--     código da transação; o dono confirma no painel e o saldo entra.
--   * Sem saldo para a comissão => não fica online, não recebe avisos, não aceita pedidos.
-- =====================================================================

-- Parâmetros (para mudar: altere o número e corra de novo)
-- Taxa paga pelo cliente: 70 MT até 2 km, +10 MT por km extra, máximo 170 MT.
create or replace function public.entregador_ganho_pedido(p_fee numeric) returns numeric
language sql immutable as $$ select least(170::numeric, coalesce(nullif(p_fee, 0), 70::numeric)) $$;

-- comissão FIXA da plataforma por entrega (MT)
create or replace function public.comissao_de(p_fee numeric) returns numeric
language sql immutable as $$ select 20::numeric $$;

-- saldo mínimo para trabalhar = 1 comissão
create or replace function public.saldo_minimo() returns numeric
language sql immutable as $$ select 20::numeric $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) $$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
alter table public.drivers add column if not exists saldo numeric not null default 0;
alter table public.orders  add column if not exists comissao numeric not null default 0;

create table if not exists public.wallet_tx (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('recarga','comissao','ajuste')),
  valor       numeric not null,             -- + entra / - sai
  saldo_apos  numeric not null,
  order_id    bigint,
  nota        text,
  created_at  timestamptz not null default now()
);
create index if not exists wallet_tx_idx on public.wallet_tx (driver_id, created_at desc);

create table if not exists public.wallet_recargas (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references auth.users(id) on delete cascade,
  valor       numeric not null check (valor >= 50 and valor <= 20000),
  metodo      text not null check (metodo in ('mpesa','emola')),
  ref         text not null,                -- código da transação (SMS)
  tel_pagador text,
  estado      text not null default 'pendente' check (estado in ('pendente','aprovada','recusada')),
  nota        text,
  created_at  timestamptz not null default now(),
  decidido_em timestamptz
);
create index if not exists wallet_recargas_idx on public.wallet_recargas (driver_id, created_at desc);
-- o mesmo código de transação não pode ser usado duas vezes
create unique index if not exists wallet_recargas_ref_uq on public.wallet_recargas (upper(ref)) where estado <> 'recusada';

alter table public.wallet_tx       enable row level security;
alter table public.wallet_recargas enable row level security;
drop policy if exists "entregador le o seu extrato"   on public.wallet_tx;
drop policy if exists "admin le extratos"             on public.wallet_tx;
drop policy if exists "entregador le as suas recargas" on public.wallet_recargas;
drop policy if exists "admin le recargas"             on public.wallet_recargas;
create policy "entregador le o seu extrato"    on public.wallet_tx       for select to authenticated using (driver_id = auth.uid());
create policy "admin le extratos"              on public.wallet_tx       for select to authenticated using (public.is_admin());
create policy "entregador le as suas recargas" on public.wallet_recargas for select to authenticated using (driver_id = auth.uid());
create policy "admin le recargas"              on public.wallet_recargas for select to authenticated using (public.is_admin());
-- (ninguém escreve direto nestas tabelas: só pelas funções abaixo)

-- ---------------------------------------------------------------------
-- Entregador pede recarga (depois de enviar o dinheiro por M-Pesa / e-Mola)
-- ---------------------------------------------------------------------
create or replace function public.entregador_pedir_recarga(p_valor numeric, p_metodo text, p_ref text, p_tel text)
returns json language plpgsql security definer set search_path = public as $$
declare v_ref text := upper(trim(coalesce(p_ref,'')));
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  if p_valor is null or p_valor < 50 or p_valor > 20000 then return json_build_object('ok',false,'erro','valor'); end if;
  if p_metodo not in ('mpesa','emola') then return json_build_object('ok',false,'erro','metodo'); end if;
  if char_length(v_ref) < 6 or char_length(v_ref) > 30 then return json_build_object('ok',false,'erro','ref'); end if;
  if (select count(*) from public.wallet_recargas where driver_id = auth.uid() and estado = 'pendente') >= 3 then
    return json_build_object('ok',false,'erro','muitas');
  end if;
  begin
    insert into public.wallet_recargas (driver_id, valor, metodo, ref, tel_pagador)
    values (auth.uid(), round(p_valor), p_metodo, v_ref, left(coalesce(p_tel,''), 15));
  exception when unique_violation then
    return json_build_object('ok',false,'erro','ref_usada');
  end;
  return json_build_object('ok',true);
end $$;
revoke all on function public.entregador_pedir_recarga(numeric,text,text,text) from public, anon;
grant execute on function public.entregador_pedir_recarga(numeric,text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- Dono aprova / recusa recarga e ajusta saldo (só admin)
-- ---------------------------------------------------------------------
create or replace function public.admin_recarga_decidir(p_id bigint, p_aprovar boolean, p_nota text default null)
returns json language plpgsql security definer set search_path = public as $$
declare r public.wallet_recargas; v_saldo numeric;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select * into r from public.wallet_recargas where id = p_id for update;
  if not found or r.estado <> 'pendente' then return json_build_object('ok',false,'erro','ja_decidida'); end if;
  if p_aprovar then
    update public.drivers set saldo = saldo + r.valor where user_id = r.driver_id returning saldo into v_saldo;
    insert into public.wallet_tx (driver_id, tipo, valor, saldo_apos, nota)
    values (r.driver_id, 'recarga', r.valor, v_saldo, upper(r.metodo) || ' ' || r.ref);
    update public.wallet_recargas set estado = 'aprovada', decidido_em = now(), nota = left(p_nota,200) where id = r.id;
  else
    update public.wallet_recargas set estado = 'recusada', decidido_em = now(), nota = left(p_nota,200) where id = r.id;
  end if;
  return json_build_object('ok',true);
end $$;
revoke all on function public.admin_recarga_decidir(bigint,boolean,text) from public, anon;
grant execute on function public.admin_recarga_decidir(bigint,boolean,text) to authenticated;

create or replace function public.admin_ajustar_saldo(p_driver uuid, p_valor numeric, p_nota text)
returns json language plpgsql security definer set search_path = public as $$
declare v_saldo numeric;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  if p_valor is null or p_valor = 0 or abs(p_valor) > 50000 then return json_build_object('ok',false,'erro','valor'); end if;
  update public.drivers set saldo = saldo + round(p_valor) where user_id = p_driver returning saldo into v_saldo;
  if not found then return json_build_object('ok',false,'erro','sem_entregador'); end if;
  insert into public.wallet_tx (driver_id, tipo, valor, saldo_apos, nota)
  values (p_driver, 'ajuste', round(p_valor), v_saldo, left(coalesce(p_nota,'Ajuste do dono'),200));
  return json_build_object('ok',true,'saldo',v_saldo);
end $$;
revoke all on function public.admin_ajustar_saldo(uuid,numeric,text) from public, anon;
grant execute on function public.admin_ajustar_saldo(uuid,numeric,text) to authenticated;

-- ---------------------------------------------------------------------
-- Aceitar pedido: exige saldo para a comissão desse pedido
-- ---------------------------------------------------------------------
create or replace function public.entregador_aceitar(p_order bigint) returns json
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_fee numeric; v_saldo numeric;
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  if exists (select 1 from public.orders where driver_id = auth.uid() and driver_stage in ('aceite','na_loja','a_caminho')) then
    return json_build_object('ok', false, 'erro', 'ja_ativa');
  end if;
  select fee into v_fee from public.orders where id = p_order;
  select saldo into v_saldo from public.drivers where user_id = auth.uid();
  if coalesce(v_saldo,0) < public.comissao_de(v_fee) then
    update public.drivers set online = false where user_id = auth.uid();
    return json_build_object('ok', false, 'erro', 'sem_saldo');
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

-- ---------------------------------------------------------------------
-- Concluir entrega: desconta a comissão do saldo; sem saldo => fica offline
-- ---------------------------------------------------------------------
create or replace function public.entregador_etapa(p_order bigint, p_etapa text) returns json
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_com numeric; v_fee numeric; v_saldo numeric;
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  select * into o from public.orders where id = p_order and driver_id = auth.uid() for update;
  if not found then return json_build_object('ok', false, 'erro', 'nao_e_seu'); end if;

  if p_etapa = 'na_loja' and o.driver_stage = 'aceite' then
    update public.orders set driver_stage = 'na_loja' where id = o.id;
  elsif p_etapa = 'a_caminho' and o.driver_stage in ('aceite','na_loja') then
    update public.orders set driver_stage = 'a_caminho', picked_at = now() where id = o.id;
  elsif p_etapa = 'entregue' and o.driver_stage = 'a_caminho' then
    v_fee := public.entregador_ganho_pedido(o.fee);      -- taxa paga pelo cliente (50..150)
    v_com := public.comissao_de(o.fee);                  -- parte da plataforma
    update public.orders
       set driver_stage = 'entregue', entregue = true, entregue_em = now(),
           ganho = v_fee - v_com, comissao = v_com
     where id = o.id;
    update public.drivers set saldo = saldo - v_com where user_id = auth.uid() returning saldo into v_saldo;
    insert into public.wallet_tx (driver_id, tipo, valor, saldo_apos, order_id, nota)
    values (auth.uid(), 'comissao', -v_com, v_saldo, o.id, 'Comissão do pedido #' || o.id);
    if v_saldo < public.saldo_minimo() then
      update public.drivers set online = false where user_id = auth.uid();   -- bloqueio automático
    end if;
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
-- Ping: sem saldo (e sem entrega em curso) não fica online
-- ---------------------------------------------------------------------
create or replace function public.entregador_ping(p_lat double precision, p_lng double precision,
  p_heading double precision default null, p_speed double precision default null, p_trail boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_track uuid; v_order bigint; v_stage text; v_saldo numeric;
begin
  select id, track_id, driver_stage into v_order, v_track, v_stage
    from public.orders
   where driver_id = auth.uid() and driver_stage in ('aceite','na_loja','a_caminho')
   limit 1;
  select saldo into v_saldo from public.drivers where user_id = auth.uid() and status = 'aprovado';
  if not found then return; end if;

  update public.drivers
     set lat = p_lat, lng = p_lng, heading = p_heading, speed = p_speed, loc_at = now(),
         online = (v_saldo >= public.saldo_minimo() or v_order is not null)
   where user_id = auth.uid();

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

-- Tempo real
do $$
begin
  begin alter publication supabase_realtime add table public.wallet_tx;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.wallet_recargas; exception when duplicate_object then null; end;
end $$;
