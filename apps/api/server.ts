import { Pool } from "pg";
import { createRemoteJWKSet } from "jose";
import { buildApi } from "./app";
import { Repository } from "./repository";
import { tokenVerifier } from "./identity";
const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error("Configuração obrigatória: " + key);
  return value;
};
const issuer = required("OIDC_ISSUER"),
  audience = required("OIDC_AUDIENCE");
const jwksUrl = new URL(required("OIDC_JWKS_URL"));
if (jwksUrl.protocol !== "https:") throw new Error("JWKS exige HTTPS.");
const jwks = createRemoteJWKSet(jwksUrl);
const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 10 });
const privilege = await pool.query(`SELECT r.rolsuper,r.rolbypassrls,
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('organizations','memberships','products','inventory_events','audit_log')
 AND pg_has_role(current_user,c.relowner,'USAGE')) AS owns_domain
 FROM pg_roles r WHERE r.rolname=current_user`);
if (
  !privilege.rows[0] ||
  privilege.rows[0].rolsuper ||
  privilege.rows[0].rolbypassrls ||
  privilege.rows[0].owns_domain
) {
  await pool.end();
  throw new Error("A API exige papel restrito, sem ownership ou bypass RLS.");
}
const api = buildApi(
  new Repository(pool),
  tokenVerifier(jwks, { issuer, audience }),
);
api.addHook("onClose", async () => {
  await pool.end();
});
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    void api.close();
  });
await api.listen({
  host: process.env.API_HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3001),
});
