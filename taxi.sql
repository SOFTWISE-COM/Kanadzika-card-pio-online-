-- =====================================================================
--  Kanandzika - TAXI (Kanandzika-Taxi) + K-MOVIES
--  Corra no Supabase (SQL Editor) DEPOIS de entregador.sql e carteira.sql.
--  Pode correr mais de uma vez.
--
--  Kanandzika-Taxi:
--   * O cliente escolhe Moto ou Carro, a partida (GPS) e o destino (mapa/pesquisa).
--   * O PREÇO É CALCULADO AQUI, na base de dados, pela distância e pelo tipo de veículo.
--       Moto : 60 MT até 2 km, +10 MT a cada 0,5 km extra
--       Carro: 150 MT até 2 km, +25 MT a cada 0,5 km extra
--     (distância = linha reta x 1,3 para aproximar a estrada)
--   * Só os entregadores com o MESMO tipo de veículo veem/aceitam a corrida.
--   * Comissão da plataforma: 10 % do preço (mínimo 10 MT), descontada do saldo
--     pré-pago do entregador ao concluir a corrida (mesma carteira das entregas).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tarifas e comissão (para mudar: altere os números e corra de novo)
-- ---------------------------------------------------------------------
create or replace function public.taxi_distancia_m(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns numeric language sql immutable as $$
  select round((2 * 6371000 * asin(sqrt(
      power(sin(radians(b_lat - a_lat) / 2), 2) +
      cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)
  )) * 1.3)::numeric)
$$;

create or replace function public.taxi_preco(p_veiculo text, p_dist_m numeric)
returns numeric language plpgsql immutable as $$
declare v_base numeric; v_km_base numeric := 2; v_meio_km numeric; v_km numeric := p_dist_m / 1000.0; v_preco numeric;
begin
  if p_veiculo = 'moto' then v_base := 60;  v_meio_km := 10;
  elsif p_veiculo = 'carro' then v_base := 150; v_meio_km := 25;
  else raise exception 'veiculo invalido'; end if;
  if v_km <= v_km_base then v_preco := v_base;
  else v_preco := v_base + ceil((v_km - v_km_base) * 2) * v_meio_km; end if;
  return round(v_preco / 5.0) * 5;          -- arredonda a 5 MT
end $$;

create or replace function public.taxi_comissao(p_preco numeric)
returns numeric language sql immutable as $$ select greatest(10::numeric, round(p_preco * 0.10)) $$;

-- ---------------------------------------------------------------------
-- Tabela de corridas
-- ---------------------------------------------------------------------
create table if not exists public.rides (
  id            bigint generated always as identity primary key,
  track_id      uuid not null default gen_random_uuid(),
  client_id     uuid not null references auth.users(id) on delete cascade,
  nome          text not null,
  tel           text not null,
  veiculo       text not null check (veiculo in ('moto','carro')),
  o_lat double precision not null, o_lng double precision not null, o_txt text,
  d_lat double precision not null, d_lng double precision not null, d_txt text,
  dist_m        integer not null,
  preco         numeric not null,
  comissao      numeric not null default 0,
  estado        text not null default 'pendente' check (estado in ('pendente','aceite','no_local','em_viagem','concluida','cancelada')),
  driver_id     uuid references auth.users(id) on delete set null,
  driver_nome   text, driver_tel text, driver_veiculo text, driver_placa text,
  driver_lat double precision, driver_lng double precision, driver_at timestamptz,
  notificado    boolean not null default false,
  created_at    timestamptz not null default now(),
  aceite_em     timestamptz,
  concluida_em  timestamptz
);
create index if not exists rides_estado_idx on public.rides (estado, veiculo, created_at desc);
create index if not exists rides_client_idx on public.rides (client_id, created_at desc);
create index if not exists rides_driver_idx on public.rides (driver_id, created_at desc);
create unique index if not exists rides_track_uq on public.rides (track_id);

-- veículo do entregador autenticado ('moto' | 'carro' | null)
create or replace function public.taxi_meu_veiculo() returns text
language sql stable security definer set search_path = public as $$
  select case lower(trim(vehicle)) when 'moto' then 'moto' when 'carro' then 'carro' else null end
    from public.drivers where user_id = auth.uid() and status = 'aprovado'
$$;
revoke all on function public.taxi_meu_veiculo() from public, anon;
grant execute on function public.taxi_meu_veiculo() to authenticated;

alter table public.rides enable row level security;
drop policy if exists "rides: cliente le as suas"   on public.rides;
drop policy if exists "rides: entregador le"        on public.rides;
drop policy if exists "rides: admin le"             on public.rides;
create policy "rides: cliente le as suas" on public.rides for select to authenticated using (client_id = auth.uid());
create policy "rides: entregador le"      on public.rides for select to authenticated using (
  driver_id = auth.uid() or (estado = 'pendente' and veiculo = public.taxi_meu_veiculo())
);
create policy "rides: admin le"           on public.rides for select to authenticated using (public.is_admin());
-- (ninguém escreve direto: só pelas funções abaixo)

-- ---------------------------------------------------------------------
-- Cliente pede corrida. O preço vem SEMPRE daqui.
-- ---------------------------------------------------------------------
create or replace function public.taxi_pedir(
  p_veiculo text, p_o_lat double precision, p_o_lng double precision, p_o_txt text,
  p_d_lat double precision, p_d_lng double precision, p_d_txt text, p_nome text, p_tel text)
returns json language plpgsql security definer set search_path = public as $$
declare v_dist numeric; v_preco numeric; r public.rides;
begin
  if auth.uid() is null then raise exception 'sem sessao'; end if;
  if p_veiculo not in ('moto','carro') then return json_build_object('ok',false,'erro','veiculo'); end if;
  if p_o_lat is null or p_o_lng is null or p_d_lat is null or p_d_lng is null
     or abs(p_o_lat) > 90 or abs(p_d_lat) > 90 or abs(p_o_lng) > 180 or abs(p_d_lng) > 180 then
    return json_build_object('ok',false,'erro','coords');
  end if;
  if char_length(trim(coalesce(p_nome,''))) < 2 or char_length(regexp_replace(coalesce(p_tel,''),'\D','','g')) < 9 then
    return json_build_object('ok',false,'erro','dados');
  end if;
  v_dist := public.taxi_distancia_m(p_o_lat,p_o_lng,p_d_lat,p_d_lng);
  if v_dist < 300 then return json_build_object('ok',false,'erro','muito_perto'); end if;
  if v_dist > 60000 then return json_build_object('ok',false,'erro','muito_longe'); end if;
  if exists (select 1 from public.rides where client_id = auth.uid() and estado in ('pendente','aceite','no_local','em_viagem')) then
    return json_build_object('ok',false,'erro','ja_ativa');
  end if;
  v_preco := public.taxi_preco(p_veiculo, v_dist);
  insert into public.rides (client_id,nome,tel,veiculo,o_lat,o_lng,o_txt,d_lat,d_lng,d_txt,dist_m,preco,comissao)
  values (auth.uid(), left(trim(p_nome),60), right(regexp_replace(p_tel,'\D','','g'),9), p_veiculo,
          p_o_lat,p_o_lng,left(coalesce(p_o_txt,''),120), p_d_lat,p_d_lng,left(coalesce(p_d_txt,''),120),
          v_dist::int, v_preco, public.taxi_comissao(v_preco))
  returning * into r;
  return json_build_object('ok',true,'id',r.id,'track_id',r.track_id,'preco',r.preco,'dist_m',r.dist_m);
end $$;
revoke all on function public.taxi_pedir(text,double precision,double precision,text,double precision,double precision,text,text,text) from public, anon;
grant execute on function public.taxi_pedir(text,double precision,double precision,text,double precision,double precision,text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- Cliente cancela (antes de a viagem começar)
-- ---------------------------------------------------------------------
create or replace function public.taxi_cancelar(p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  update public.rides set estado = 'cancelada'
   where id = p_id and client_id = auth.uid() and estado in ('pendente','aceite','no_local')
   returning id into v_id;
  if v_id is null then return json_build_object('ok',false,'erro','nao_pode'); end if;
  return json_build_object('ok',true);
end $$;
revoke all on function public.taxi_cancelar(bigint) from public, anon;
grant execute on function public.taxi_cancelar(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- Entregador aceita (mesmo veículo, saldo para a comissão, sem outra tarefa ativa)
-- ---------------------------------------------------------------------
create or replace function public.taxi_aceitar(p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare d public.drivers; r public.rides; v_id bigint;
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  select * into d from public.drivers where user_id = auth.uid() and status = 'aprovado';
  if not found then raise exception 'sem permissão'; end if;
  if exists (select 1 from public.rides  where driver_id = auth.uid() and estado in ('aceite','no_local','em_viagem'))
     or exists (select 1 from public.orders where driver_id = auth.uid() and driver_stage in ('aceite','na_loja','a_caminho')) then
    return json_build_object('ok',false,'erro','ja_ativa');
  end if;
  select * into r from public.rides where id = p_id;
  if not found or r.estado <> 'pendente' then return json_build_object('ok',false,'erro','indisponivel'); end if;
  if r.veiculo is distinct from public.taxi_meu_veiculo() then return json_build_object('ok',false,'erro','veiculo'); end if;
  if coalesce(d.saldo,0) < r.comissao then return json_build_object('ok',false,'erro','sem_saldo'); end if;
  update public.rides
     set estado = 'aceite', driver_id = auth.uid(), aceite_em = now(),
         driver_nome = d.name, driver_tel = d.phone, driver_veiculo = d.vehicle, driver_placa = d.plate,
         driver_lat = d.lat, driver_lng = d.lng, driver_at = now()
   where id = p_id and estado = 'pendente'
   returning id into v_id;
  if v_id is null then return json_build_object('ok',false,'erro','indisponivel'); end if;
  return json_build_object('ok',true);
end $$;
revoke all on function public.taxi_aceitar(bigint) from public, anon;
grant execute on function public.taxi_aceitar(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- Etapas da corrida: no_local -> iniciar -> concluir (ou libertar)
-- ---------------------------------------------------------------------
create or replace function public.taxi_etapa(p_id bigint, p_etapa text) returns json
language plpgsql security definer set search_path = public as $$
declare r public.rides; v_saldo numeric;
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  select * into r from public.rides where id = p_id and driver_id = auth.uid() for update;
  if not found then return json_build_object('ok',false,'erro','nao_e_sua'); end if;

  if p_etapa = 'no_local' and r.estado = 'aceite' then
    update public.rides set estado = 'no_local' where id = r.id;
  elsif p_etapa = 'iniciar' and r.estado in ('aceite','no_local') then
    update public.rides set estado = 'em_viagem' where id = r.id;
  elsif p_etapa = 'concluir' and r.estado = 'em_viagem' then
    update public.rides set estado = 'concluida', concluida_em = now() where id = r.id;
    update public.drivers set saldo = saldo - r.comissao where user_id = auth.uid() returning saldo into v_saldo;
    insert into public.wallet_tx (driver_id, tipo, valor, saldo_apos, nota)
    values (auth.uid(), 'comissao', -r.comissao, v_saldo, 'Comissão da corrida taxi #' || r.id);
    if v_saldo < public.saldo_minimo() then
      update public.drivers set online = false where user_id = auth.uid();
    end if;
  elsif p_etapa = 'libertar' and r.estado in ('aceite','no_local') then
    update public.rides set estado = 'pendente', driver_id = null, aceite_em = null, notificado = false,
           driver_nome = null, driver_tel = null, driver_veiculo = null, driver_placa = null,
           driver_lat = null, driver_lng = null, driver_at = null
     where id = r.id;
  else
    return json_build_object('ok',false,'erro','etapa_invalida');
  end if;
  return json_build_object('ok',true);
end $$;
revoke all on function public.taxi_etapa(bigint,text) from public, anon;
grant execute on function public.taxi_etapa(bigint,text) to authenticated;

-- Posição do entregador durante a corrida (o cliente vê no mapa)
create or replace function public.taxi_ping(p_lat double precision, p_lng double precision) returns void
language sql security definer set search_path = public as $$
  update public.rides set driver_lat = p_lat, driver_lng = p_lng, driver_at = now()
   where driver_id = auth.uid() and estado in ('aceite','no_local','em_viagem')
$$;
revoke all on function public.taxi_ping(double precision,double precision) from public, anon;
grant execute on function public.taxi_ping(double precision,double precision) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.rides; exception when duplicate_object then null; end;
end $$;

-- =====================================================================
--  K-MOVIES  (catálogo estilo Netflix)
--  O dono adiciona os títulos no Supabase (Table Editor) ou por SQL.
--  Só coloque conteúdo que TEM DIREITO de distribuir (licenciado, próprio ou livre).
-- =====================================================================
create table if not exists public.k_titles (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('filme','serie')),
  titulo      text not null,
  sinopse     text,
  ano         int,
  duracao     text,                  -- ex.: '1h 42min' (filmes) ou '3 temporadas' (séries)
  generos     text[] not null default '{}',
  classificacao text,                -- ex.: '12+'
  idioma      text not null default 'Português',   -- idioma do áudio
  poster_url  text,                  -- vertical (2:3)
  capa_url    text,                  -- horizontal (16:9), usada no destaque
  video_url   text,                  -- só para filmes (mp4 / webm)
  legenda_url text,                  -- só para filmes: ficheiro .vtt ou .srt em português
  destaque    boolean not null default false,
  ativo       boolean not null default true,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.k_episodios (
  id          bigint generated always as identity primary key,
  title_id    bigint not null references public.k_titles(id) on delete cascade,
  temporada   int not null default 1,
  numero      int not null,
  titulo      text,
  sinopse     text,
  duracao     text,
  video_url   text not null,
  legenda_url text,
  unique (title_id, temporada, numero)
);
alter table public.k_titles    enable row level security;
alter table public.k_episodios enable row level security;
drop policy if exists "k_titles: ler"     on public.k_titles;
drop policy if exists "k_titles: admin"   on public.k_titles;
drop policy if exists "k_episodios: ler"  on public.k_episodios;
drop policy if exists "k_episodios: admin" on public.k_episodios;
create policy "k_titles: ler"      on public.k_titles    for select to authenticated using (ativo or public.is_admin());
create policy "k_titles: admin"    on public.k_titles    for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "k_episodios: ler"   on public.k_episodios for select to authenticated using (exists (select 1 from public.k_titles t where t.id = title_id and (t.ativo or public.is_admin())));
create policy "k_episodios: admin" on public.k_episodios for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Exemplo (filmes livres da Blender Foundation, licença Creative Commons). Apague/troque pelos seus.
insert into public.k_titles (tipo,titulo,sinopse,ano,duracao,generos,classificacao,idioma,poster_url,capa_url,video_url,destaque,ordem)
select 'filme','Big Buck Bunny','Um coelho gigante e bondoso enfrenta três roedores brincalhões. Animação de exemplo, sem diálogos.',2008,'10min',array['Animação','Família'],'Livre','Sem diálogos',
       null,null,'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',true,1
where not exists (select 1 from public.k_titles where titulo = 'Big Buck Bunny');
insert into public.k_titles (tipo,titulo,sinopse,ano,duracao,generos,classificacao,idioma,poster_url,capa_url,video_url,destaque,ordem)
select 'filme','Sintel','Uma jovem parte em busca do dragão que ela criou e perdeu. Animação de exemplo.',2010,'15min',array['Animação','Fantasia'],'12+','Inglês',
       null,null,'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',false,2
where not exists (select 1 from public.k_titles where titulo = 'Sintel');

-- ---------------------------------------------------------------------
-- Uma tarefa de cada vez: aceitar ENTREGA também verifica se há corrida de taxi em curso
-- (igual ao entregador_aceitar do carteira.sql, com 1 verificação a mais)
-- ---------------------------------------------------------------------
create or replace function public.entregador_aceitar(p_order bigint) returns json
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_fee numeric; v_saldo numeric;
begin
  if not public.is_driver() then raise exception 'sem permissão'; end if;
  if exists (select 1 from public.orders where driver_id = auth.uid() and driver_stage in ('aceite','na_loja','a_caminho'))
     or exists (select 1 from public.rides where driver_id = auth.uid() and estado in ('aceite','no_local','em_viagem')) then
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
