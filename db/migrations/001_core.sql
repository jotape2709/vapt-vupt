-- Execute as a migration owner. Runtime must be a separate NOSUPERUSER NOBYPASSRLS role.
CREATE TABLE organizations (
 id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 2 AND 60),
 theme jsonb NOT NULL DEFAULT '{"version":1}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE units (
 organization_id uuid NOT NULL REFERENCES organizations(id),
 id uuid NOT NULL, name text NOT NULL, PRIMARY KEY(organization_id,id)
);
CREATE TABLE memberships (
 organization_id uuid NOT NULL REFERENCES organizations(id), subject text NOT NULL, issuer text NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','operator','viewer')),
 PRIMARY KEY(organization_id,subject,issuer)
);
CREATE TABLE products (
 organization_id uuid NOT NULL REFERENCES organizations(id), id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120), sku text NOT NULL,
 unit text NOT NULL CHECK(unit IN ('un','kg','cx','L')),
 minimum integer NOT NULL CHECK(minimum BETWEEN 0 AND 1000000),
 quantity integer NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 1000000),
 category text NOT NULL, version integer NOT NULL DEFAULT 0,
 PRIMARY KEY(organization_id,id)
);
CREATE UNIQUE INDEX products_sku_unique ON products(organization_id,lower(sku));
CREATE TABLE inventory_events (
 organization_id uuid NOT NULL, id uuid NOT NULL, product_id uuid NOT NULL,
 payload jsonb NOT NULL, result jsonb NOT NULL, subject text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,product_id) REFERENCES products(organization_id,id)
);
CREATE TABLE audit_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id uuid NOT NULL REFERENCES organizations(id), subject text NOT NULL,
 action text NOT NULL, entity_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_time ON audit_log(organization_id,created_at DESC);
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','units','memberships','products','inventory_events','audit_log']
 LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  IF t='organizations' THEN
   EXECUTE format('CREATE POLICY tenant_policy ON %I USING (id = nullif(current_setting(''app.org_id'',true),'''')::uuid) WITH CHECK (id = nullif(current_setting(''app.org_id'',true),'''')::uuid)',t);
  ELSE
   EXECUTE format('CREATE POLICY tenant_policy ON %I USING (organization_id = nullif(current_setting(''app.org_id'',true),'''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.org_id'',true),'''')::uuid)',t);
  END IF;
 END LOOP;
END $$;
-- Provision runtime role externally, never commit passwords.
-- GRANT USAGE ON SCHEMA public TO vv_runtime;
-- GRANT SELECT ON organizations,memberships,units,products,inventory_events TO vv_runtime;
-- GRANT UPDATE(theme) ON organizations TO vv_runtime;
-- GRANT INSERT,UPDATE ON products TO vv_runtime;
-- GRANT INSERT ON inventory_events,audit_log TO vv_runtime;
-- GRANT USAGE,SELECT ON SEQUENCE audit_log_id_seq TO vv_runtime;
-- Do not grant UPDATE or DELETE on inventory_events or audit_log.
