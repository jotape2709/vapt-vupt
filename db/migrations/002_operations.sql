-- 002 — operação real: sessões de servidor, usuários, saldo por unidade, histórico imutável,
-- configuração versionada por empresa e logotipos validados.
-- Aditiva: não altera nem remove dados de 001. Executar como dono do schema (conta de migração).
--
-- FORCE ROW LEVEL SECURITY de 001 também vale para o dono das tabelas. Para migrar os dados
-- existentes, esta transação desliga o FORCE nas tabelas tocadas e o religa no final.
ALTER TABLE organizations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE units NO FORCE ROW LEVEL SECURITY;
ALTER TABLE products NO FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_events NO FORCE ROW LEVEL SECURITY;

-- Normalização para busca no servidor: minúsculas e sem acentos do português.
-- Sem extensão (unaccent exige privilégios que a conta de migração pode não ter).
CREATE FUNCTION vv_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT lower(translate(coalesce(value, ''),
  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
$$;

-- Tabelas que só aceitam inserção. Grants também negam UPDATE/DELETE; o gatilho protege
-- contra um papel com grants excessivos.
CREATE FUNCTION vv_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION '% aceita somente inserção', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;

------------------------------------------------------------------------------
-- Organizações: segmento e ponteiro para a configuração vigente.
------------------------------------------------------------------------------
ALTER TABLE organizations
 ADD COLUMN segment text NOT NULL DEFAULT 'other' CHECK (segment IN ('market', 'wine_shop', 'bar', 'other')),
 ADD COLUMN settings_version integer NOT NULL DEFAULT 0 CHECK (settings_version >= 0);
COMMENT ON COLUMN organizations.theme IS 'Obsoleto desde 002. Preservado sem alteração; a configuração vigente está em organization_settings.';

-- Configuração versionada (append-only). A versão vigente é organizations.settings_version.
CREATE TABLE organization_settings (
 organization_id uuid NOT NULL REFERENCES organizations(id),
 version integer NOT NULL CHECK (version > 0),
 settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by text NOT NULL,
 PRIMARY KEY (organization_id, version)
);
CREATE TRIGGER organization_settings_append_only BEFORE UPDATE OR DELETE ON organization_settings
 FOR EACH ROW EXECUTE FUNCTION vv_append_only();

-- Migração explícita: o tema v1 de cada organização vira a versão 1 da configuração.
-- Cores antigas (forest/wine/copper) mapeiam para as paletas azuis atuais.
-- Logotipos antigos (data URL no tema) NÃO são migrados: nunca passaram pela validação de
-- arquivo do servidor. Ficam intocados em organizations.theme; o proprietário reenvia.
INSERT INTO organization_settings (organization_id, version, settings, created_by)
SELECT o.id, 1, jsonb_build_object(
 'schemaVersion', 2,
 'identity', jsonb_build_object(
  'displayName', CASE WHEN length(btrim(coalesce(o.theme->>'name', ''))) BETWEEN 2 AND 60 THEN btrim(o.theme->>'name') ELSE o.name END,
  'segment', 'other',
  'logoAssetId', NULL),
 'appearance', jsonb_build_object(
  'palette', CASE o.theme->>'accent' WHEN 'navy' THEN 'navy' WHEN 'wine' THEN 'navy' WHEN 'sky' THEN 'sky' WHEN 'copper' THEN 'sky' ELSE 'blue' END,
  'mode', CASE WHEN o.theme->>'mode' = 'dark' THEN 'dark' ELSE 'light' END,
  'font', CASE WHEN o.theme->>'font' = 'system' THEN 'system' ELSE 'humanist' END,
  'density', CASE WHEN o.theme->>'density' = 'compact' THEN 'compact' ELSE 'comfortable' END),
 'modules', (
  SELECT jsonb_agg(m ORDER BY array_position(ARRAY['overview','inventory','products','movements','purchases','quotes','team'], m))
  FROM (
   SELECT DISTINCT m FROM (
    SELECT 'overview' AS m
    UNION ALL
    SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(o.theme->'modules') = 'array' THEN o.theme->'modules' ELSE '["inventory","products","movements"]'::jsonb END)
   ) raw WHERE m IN ('overview','inventory','products','movements','purchases','quotes','team')
  ) allowed),
 'navigation', jsonb_build_object('landing', 'overview'),
 'overview', jsonb_build_object('blocks', '["quick_find","metrics","priority","recent","daily_note"]'::jsonb),
 'catalog', jsonb_build_object('suggestedCategories', '[]'::jsonb)
), 'migration:002'
FROM organizations o;
UPDATE organizations SET settings_version = 1;

------------------------------------------------------------------------------
-- Unidades: uma unidade principal por organização (piloto opera uma unidade).
------------------------------------------------------------------------------
ALTER TABLE units
 ADD COLUMN is_primary boolean NOT NULL DEFAULT false,
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD CONSTRAINT units_name_length CHECK (length(name) BETWEEN 2 AND 60) NOT VALID;
CREATE UNIQUE INDEX units_one_primary ON units (organization_id) WHERE is_primary;

-- Organizações sem unidade recebem "Unidade principal"; nas demais, a menor id vira principal.
INSERT INTO units (organization_id, id, name, is_primary)
SELECT o.id, gen_random_uuid(), 'Unidade principal', true
FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM units u WHERE u.organization_id = o.id);
UPDATE units u SET is_primary = true
WHERE NOT EXISTS (SELECT 1 FROM units p WHERE p.organization_id = u.organization_id AND p.is_primary)
 AND u.id = (SELECT min(x.id::text)::uuid FROM units x WHERE x.organization_id = u.organization_id);

------------------------------------------------------------------------------
-- Produtos: catálogo por organização. O saldo sai do cadastro e vai para stock_levels.
------------------------------------------------------------------------------
ALTER TABLE products
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN search_text text GENERATED ALWAYS AS (vv_normalize(name || ' ' || sku || ' ' || category)) STORED;
COMMENT ON COLUMN products.quantity IS 'Congelado desde 002: saldo agregado de 001, copiado para stock_levels da unidade principal. Não é mantido.';
COMMENT ON COLUMN products.version IS 'Desde 002: versão do cadastro (nome, mínimo, categoria). A versão do saldo está em stock_levels.version.';
CREATE INDEX products_name_order ON products (organization_id, lower(name), id);

-- Saldo por unidade. A versão continua a de 001 para não invalidar expectedVersion em uso.
CREATE TABLE stock_levels (
 organization_id uuid NOT NULL,
 unit_id uuid NOT NULL,
 product_id uuid NOT NULL,
 quantity integer NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 1000000),
 version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id, unit_id, product_id),
 FOREIGN KEY (organization_id, unit_id) REFERENCES units (organization_id, id),
 FOREIGN KEY (organization_id, product_id) REFERENCES products (organization_id, id)
);
INSERT INTO stock_levels (organization_id, unit_id, product_id, quantity, version)
SELECT p.organization_id, u.id, p.id, p.quantity, p.version
FROM products p JOIN units u ON u.organization_id = p.organization_id AND u.is_primary;

-- Depois da cópia, o saldo do cadastro não muda mais e produtos novos nascem com zero.
CREATE FUNCTION vv_products_quantity_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' AND NEW.quantity <> 0 THEN
  RAISE EXCEPTION 'Produto nasce com saldo zero; registre uma entrada' USING ERRCODE = 'check_violation';
 END IF;
 IF TG_OP = 'UPDATE' AND NEW.quantity IS DISTINCT FROM OLD.quantity THEN
  RAISE EXCEPTION 'products.quantity está congelado desde 002; use stock_levels' USING ERRCODE = 'check_violation';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER products_quantity_frozen BEFORE INSERT OR UPDATE OF quantity ON products
 FOR EACH ROW EXECUTE FUNCTION vv_products_quantity_frozen();

------------------------------------------------------------------------------
-- Eventos de estoque: colunas explícitas, unidade, autor e saldos antes/depois.
------------------------------------------------------------------------------
ALTER TABLE inventory_events
 ADD COLUMN unit_id uuid,
 ADD COLUMN kind text,
 ADD COLUMN quantity integer,
 ADD COLUMN reason text,
 ADD COLUMN expected_version integer,
 ADD COLUMN balance_before integer,
 ADD COLUMN balance_after integer,
 ADD COLUMN stock_version integer,
 ADD COLUMN actor_issuer text,
 ADD COLUMN actor_name text;

-- Eventos de 001 pertencem à unidade principal; os valores vêm do payload e do resultado gravados.
UPDATE inventory_events e SET
 unit_id = u.id,
 kind = e.payload->>'kind',
 quantity = (e.payload->>'quantity')::integer,
 reason = e.payload->>'reason',
 expected_version = (e.payload->>'expectedVersion')::integer,
 balance_after = (e.result->>'quantity')::integer,
 balance_before = (e.result->>'quantity')::integer
  - CASE WHEN e.payload->>'kind' = 'receipt' THEN (e.payload->>'quantity')::integer ELSE -(e.payload->>'quantity')::integer END,
 stock_version = (e.result->>'version')::integer
FROM units u
WHERE u.organization_id = e.organization_id AND u.is_primary;

ALTER TABLE inventory_events
 ALTER COLUMN unit_id SET NOT NULL,
 ALTER COLUMN kind SET NOT NULL,
 ALTER COLUMN quantity SET NOT NULL,
 ALTER COLUMN reason SET NOT NULL,
 ALTER COLUMN expected_version SET NOT NULL,
 ALTER COLUMN balance_before SET NOT NULL,
 ALTER COLUMN balance_after SET NOT NULL,
 ALTER COLUMN stock_version SET NOT NULL,
 ADD CONSTRAINT inventory_events_unit_fk FOREIGN KEY (organization_id, unit_id) REFERENCES units (organization_id, id),
 ADD CONSTRAINT inventory_events_kind CHECK (kind IN ('receipt', 'issue')),
 ADD CONSTRAINT inventory_events_quantity CHECK (quantity BETWEEN 1 AND 1000000),
 ADD CONSTRAINT inventory_events_balances CHECK (
  balance_before BETWEEN 0 AND 1000000 AND balance_after BETWEEN 0 AND 1000000
  AND balance_after = balance_before + CASE WHEN kind = 'receipt' THEN quantity ELSE -quantity END);
CREATE INDEX inventory_events_unit_time ON inventory_events (organization_id, unit_id, created_at DESC, id DESC);
CREATE INDEX inventory_events_product_time ON inventory_events (organization_id, unit_id, product_id, created_at DESC, id DESC);
CREATE TRIGGER inventory_events_append_only BEFORE UPDATE OR DELETE ON inventory_events
 FOR EACH ROW EXECUTE FUNCTION vv_append_only();

ALTER TABLE audit_log ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
 FOR EACH ROW EXECUTE FUNCTION vv_append_only();

------------------------------------------------------------------------------
-- Logotipos validados no servidor, isolados por organização.
------------------------------------------------------------------------------
CREATE TABLE organization_assets (
 organization_id uuid NOT NULL REFERENCES organizations(id),
 id uuid NOT NULL,
 kind text NOT NULL CHECK (kind = 'logo'),
 content_type text NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 262144),
 width integer NOT NULL CHECK (width BETWEEN 16 AND 1024),
 height integer NOT NULL CHECK (height BETWEEN 16 AND 1024),
 sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 content bytea NOT NULL CHECK (octet_length(content) = byte_size),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by text NOT NULL,
 PRIMARY KEY (organization_id, id)
);
CREATE TRIGGER organization_assets_append_only BEFORE UPDATE ON organization_assets
 FOR EACH ROW EXECUTE FUNCTION vv_append_only();

------------------------------------------------------------------------------
-- Usuários (identidade externa) e preferências pessoais.
------------------------------------------------------------------------------
CREATE TABLE users (
 issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 255),
 subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
 display_name text CHECK (length(display_name) <= 120),
 email text CHECK (length(email) <= 254),
 preferences jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences) = 'object'),
 last_organization_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_login_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (issuer, subject)
);

------------------------------------------------------------------------------
-- Sessões de servidor e transações OIDC. O cookie leva um segredo aleatório; o banco guarda
-- apenas o SHA-256. Sem RLS: a busca acontece antes de a identidade ser conhecida.
------------------------------------------------------------------------------
CREATE TABLE sessions (
 id_hash bytea PRIMARY KEY CHECK (octet_length(id_hash) = 32),
 issuer text NOT NULL,
 subject text NOT NULL,
 csrf_token text NOT NULL CHECK (length(csrf_token) >= 32),
 id_token_hint text,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 idle_expires_at timestamptz NOT NULL,
 absolute_expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 revoked_reason text CHECK (revoked_reason IN ('logout', 'admin', 'rotated', 'expired'))
);
CREATE INDEX sessions_identity ON sessions (issuer, subject);
CREATE INDEX sessions_absolute_expiry ON sessions (absolute_expires_at);

CREATE TABLE auth_transactions (
 id_hash bytea PRIMARY KEY CHECK (octet_length(id_hash) = 32),
 state text NOT NULL,
 nonce text NOT NULL,
 code_verifier text NOT NULL,
 return_to text NOT NULL CHECK (return_to ~ '^/[^/\\]'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);

------------------------------------------------------------------------------
-- RLS das novas tabelas e políticas de autoconsulta.
------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['organization_settings', 'stock_levels', 'organization_assets']
 LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY tenant_policy ON %I USING (organization_id = nullif(current_setting(''app.org_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.org_id'', true), '''')::uuid)', t);
 END LOOP;
END $$;

-- Cada pessoa lê apenas o próprio registro de usuário.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_policy ON users
 USING (issuer = current_setting('app.issuer', true) AND subject = current_setting('app.subject', true))
 WITH CHECK (issuer = current_setting('app.issuer', true) AND subject = current_setting('app.subject', true));

-- Para listar as empresas autorizadas: as próprias memberships e as organizações correspondentes.
-- Somente leitura; escrever continua exigindo app.org_id.
CREATE POLICY self_select ON memberships FOR SELECT
 USING (subject = current_setting('app.subject', true) AND issuer = current_setting('app.issuer', true));
CREATE POLICY member_select ON organizations FOR SELECT
 USING (EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = organizations.id
  AND m.subject = current_setting('app.subject', true) AND m.issuer = current_setting('app.issuer', true)));
CREATE POLICY member_select ON organization_settings FOR SELECT
 USING (EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = organization_settings.organization_id
  AND m.subject = current_setting('app.subject', true) AND m.issuer = current_setting('app.issuer', true)));

ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE units FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_events FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_levels FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
