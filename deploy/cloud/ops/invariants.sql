-- Métricas e invariantes do banco vapt_vupt numa linha JSON. Usado pelo backup DENTRO do mesmo
-- snapshot do pg_dump (o manifesto descreve exatamente o que foi copiado) e pela restauração, que
-- recalcula tudo no banco restaurado e exige igualdade. Rodar como superusuário (sem filtro de RLS).
WITH counts AS (
 SELECT coalesce(jsonb_object_agg(tablename, (xpath('/row/c/text()',
  query_to_xml(format('SELECT count(*) AS c FROM public.%I', tablename), false, true, '')))[1]::text::bigint), '{}') AS j
 FROM pg_tables WHERE schemaname = 'public'
), last_event AS (
 SELECT DISTINCT ON (organization_id, unit_id, product_id) organization_id, unit_id, product_id, balance_after, stock_version
 FROM inventory_events ORDER BY organization_id, unit_id, product_id, stock_version DESC
), chain AS (
 SELECT balance_before, stock_version,
  lag(balance_after) OVER w AS prev_after, lag(stock_version) OVER w AS prev_version
 FROM inventory_events WINDOW w AS (PARTITION BY organization_id, unit_id, product_id ORDER BY stock_version)
)
SELECT jsonb_build_object(
 'schemaVersion', (SELECT max(version) FROM schema_migrations),
 'rowCounts', (SELECT j FROM counts),
 'stockQuantitySum', (SELECT coalesce(sum(quantity), 0) FROM stock_levels),
 'eventsSignedSum', (SELECT coalesce(sum(CASE WHEN kind = 'receipt' THEN quantity ELSE -quantity END), 0) FROM inventory_events),
 -- saldo atual = saldo depois do último evento, e versão do saldo = versão do último evento
 'stockMismatches', (SELECT count(*) FROM stock_levels s JOIN last_event e USING (organization_id, unit_id, product_id)
   WHERE s.quantity <> e.balance_after OR s.version <> e.stock_version),
 -- cada evento começa onde o anterior do mesmo produto/unidade terminou, sem versões puladas
 'chainBreaks', (SELECT count(*) FROM chain WHERE prev_after IS NOT NULL AND (balance_before <> prev_after OR stock_version <> prev_version + 1)),
 'orgsWithoutOwner', (SELECT count(*) FROM organizations o WHERE NOT EXISTS
   (SELECT 1 FROM memberships m WHERE m.organization_id = o.id AND m.role = 'owner')),
 'rlsForced', (SELECT coalesce(string_agg(relname, ',' ORDER BY relname), '') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND relkind = 'r' AND relrowsecurity AND relforcerowsecurity),
 'tableOwners', (SELECT coalesce(string_agg(DISTINCT pg_get_userbyid(relowner), ','), '') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND relkind = 'r')
)::text;
