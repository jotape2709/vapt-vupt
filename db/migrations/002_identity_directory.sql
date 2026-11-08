DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Migration 002 requires the dedicated migration role with BYPASSRLS';
 END IF;
END $$;
-- Directory access is read-only and limited to the verified identity.
-- app.subject/issuer are set by the API inside a transaction, never from request bodies.
CREATE POLICY identity_directory ON memberships FOR SELECT USING (
 subject = current_setting('app.subject',true)
 AND issuer = current_setting('app.issuer',true)
);
CREATE POLICY identity_directory ON organizations FOR SELECT USING (
 EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id=organizations.id
 AND m.subject=current_setting('app.subject',true)
 AND m.issuer=current_setting('app.issuer',true))
);
CREATE INDEX memberships_identity ON memberships(issuer,subject,organization_id);
-- Theme contract v2: blue family, preserving each organization's other preferences.
UPDATE organizations SET theme =
 jsonb_build_object('name',name,'mode','light','density','comfortable','font','humanist',
 'modules',jsonb_build_array('overview','inventory','products','movements'))
 || theme || jsonb_build_object('version',2,'accent',CASE theme->>'accent'
 WHEN 'wine' THEN 'navy' WHEN 'copper' THEN 'sky'
 WHEN 'navy' THEN 'navy' WHEN 'sky' THEN 'sky' ELSE 'blue' END);

ALTER TABLE organizations ALTER COLUMN theme SET DEFAULT '{"version":2,"name":"Minha empresa","accent":"blue","mode":"light","density":"comfortable","font":"humanist","modules":["overview","inventory","products","movements"]}'::jsonb;
