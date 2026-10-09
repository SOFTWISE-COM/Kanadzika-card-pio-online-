-- =====================================================================
-- FATURAÇÃO CONFIRMADA - Kanandzika
-- Cole no Supabase: SQL Editor > New query > Run  (pode correr mais de uma vez)
-- O dinheiro só entra na faturação quando: a entrega foi concluída (Delivery)
-- e o administrador confirmou o pagamento.
-- =====================================================================

alter table public.orders add column if not exists entregue    boolean not null default false;
alter table public.orders add column if not exists entregue_em timestamptz;
alter table public.orders add column if not exists pago        boolean not null default false;
alter table public.orders add column if not exists pago_em     timestamptz;

-- O administrador pode atualizar pedidos (entregue / pago)
drop policy if exists "admin atualiza pedidos" on public.orders;
create policy "admin atualiza pedidos" on public.orders
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- OPCIONAL: se quiser contar como pagos os pedidos ANTIGOS (antes desta versão),
-- tire os dois traços das 3 linhas abaixo e corra. Se não, o histórico antigo fica "por confirmar".
-- update public.orders set pago = true, pago_em = created_at,
--   entregue = true, entregue_em = created_at
--  where pago = false;
