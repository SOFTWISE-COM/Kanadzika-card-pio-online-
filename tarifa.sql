-- =====================================================================
--  Kanandzika - Tarifa de entrega por distância (corra uma vez no Supabase)
--  Cliente paga: 50 MT até 2 km, +10 MT por km extra (de 0,5 em 0,5 km), máximo 150 MT.
--  O entregador recebe a taxa paga pelo cliente (mínimo 50, máximo 150).
-- =====================================================================
create or replace function public.entregador_ganho_pedido(p_fee numeric) returns numeric
language sql immutable as $$
  select least(150::numeric, greatest(50::numeric, coalesce(nullif(p_fee, 0), 50::numeric)))
$$;

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
       set driver_stage = 'entregue', entregue = true, entregue_em = now(),
           ganho = public.entregador_ganho_pedido(o.fee)
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
