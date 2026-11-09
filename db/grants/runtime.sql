-- Privilégios mínimos do papel de runtime da API, concedidos ao papel de grupo vv_app.
-- vv_app é NOLOGIN, NOSUPERUSER, NOBYPASSRLS e não é dono de nenhuma tabela.
-- O papel de login real da API recebe: GRANT vv_app TO <papel_de_login>;
-- `npm run db:migrate` aplica este arquivo quando vv_app existe. É idempotente.
-- Nunca versionar senhas: crie os papéis fora do repositório (ver docs/OPERATIONS.md).
GRANT USAGE ON SCHEMA public TO vv_app;

GRANT SELECT ON organizations, memberships, units, products, stock_levels, inventory_events,
 organization_settings, organization_assets TO vv_app;

-- Configuração: nova versão (INSERT) e avanço do ponteiro vigente.
GRANT INSERT ON organization_settings TO vv_app;
GRANT UPDATE (settings_version) ON organizations TO vv_app;
GRANT INSERT ON organization_assets TO vv_app;

-- Catálogo: cadastro e edição sem acesso ao saldo congelado de 001.
GRANT INSERT ON products TO vv_app;
GRANT UPDATE (name, minimum, category, version, updated_at) ON products TO vv_app;

-- Saldo por unidade e histórico imutável.
GRANT INSERT ON stock_levels TO vv_app;
GRANT UPDATE (quantity, version, updated_at) ON stock_levels TO vv_app;
GRANT INSERT ON inventory_events, audit_log TO vv_app;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO vv_app;

-- Identidade e sessões.
GRANT SELECT, INSERT ON users TO vv_app;
GRANT UPDATE (display_name, email, preferences, last_organization_id, last_login_at) ON users TO vv_app;
GRANT SELECT, INSERT, DELETE ON sessions TO vv_app;
GRANT UPDATE (last_seen_at, idle_expires_at, revoked_at, revoked_reason, id_token_hint) ON sessions TO vv_app;
GRANT SELECT, INSERT, DELETE ON auth_transactions TO vv_app;

GRANT EXECUTE ON FUNCTION vv_normalize(text) TO vv_app;

-- Não conceder UPDATE/DELETE em inventory_events, audit_log ou organization_settings,
-- nem escrita em memberships, organizations.name ou units: isso é provisionamento administrativo.

-- Leitura do registro de migrations: a API confere, ao iniciar, se pode operar sobre o schema
-- encontrado (versão anterior sobre schema novo só se declarado compatível; apps/api/migrations.ts).
GRANT SELECT ON schema_migrations TO vv_app;
