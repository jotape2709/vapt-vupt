import type { OidcClaims, OidcProvider } from '../../apps/api/oidc';

/**
 * FIXTURE DE TESTE — nunca importada pelo servidor. Simula um provedor OIDC para exercitar as
 * rotas /auth (state, transação de uso único, rotação de sessão) sem rede. O fluxo com provedor
 * real (Keycloak) é coberto pelos testes de navegador em tests/e2e-real.
 * O "code" devolvido ao callback é o apelido do usuário cadastrado na fixture.
 */
export function oidcFixture(issuer: string, users: Record<string, Omit<OidcClaims, 'issuer'>>): OidcProvider {
 return {
  issuer,
  authorizationUrl: ({ redirectUri, state, nonce }) => {
   const url = new URL(issuer + '/authorize');
   url.search = new URLSearchParams({ redirect_uri: redirectUri, state, nonce }).toString();
   return url;
  },
  async completeLogin(currentUrl, checks) {
   if (currentUrl.searchParams.get('state') !== checks.state) throw new Error('state divergente');
   const user = users[currentUrl.searchParams.get('code') ?? ''];
   if (!user) throw new Error('code inválido');
   return { claims: { issuer, ...user }, idToken: 'fixture-id-token-' + user.subject };
  },
  endSessionUrl: ({ postLogoutRedirectUri }) => new URL(issuer + '/logout?post_logout_redirect_uri=' + encodeURIComponent(postLogoutRedirectUri))
 };
}
