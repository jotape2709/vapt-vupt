import * as client from 'openid-client';

export type OidcClaims = { issuer: string; subject: string; name: string | null; email: string | null };

/** Porta usada pelas rotas /auth. Em produção é sempre a implementação openid-client abaixo. */
export interface OidcProvider {
 readonly issuer: string;
 authorizationUrl(input: { redirectUri: string; state: string; nonce: string; codeChallenge: string }): URL;
 completeLogin(currentUrl: URL, checks: { state: string; nonce: string; codeVerifier: string }): Promise<{ claims: OidcClaims; idToken: string | null }>;
 endSessionUrl(input: { idTokenHint: string | null; postLogoutRedirectUri: string }): URL | null;
}

export type OidcOptions = {
 issuer: string; clientId: string; clientSecret: string;
 /** Somente desenvolvimento: aceitar emissor http em localhost (ex.: Keycloak do Compose). */
 allowHttp: boolean;
 /**
  * Somente desenvolvimento em contêiner: o navegador usa OIDC_ISSUER (ex.: http://localhost:8080),
  * mas a API alcança o provedor por outro endereço interno (ex.: http://keycloak:8080).
  * As chamadas de servidor para servidor trocam apenas a origem; o emissor validado não muda.
  */
 internalOrigin?: string;
};

/**
 * Cliente OIDC confidencial (Authorization Code + PKCE S256 + state + nonce) com openid-client,
 * biblioteca certificada pela OpenID Foundation. A validação do ID Token (assinatura via JWKS,
 * iss, aud, exp, iat, nonce) é feita pela biblioteca a partir do documento de discovery.
 */
export async function createOidcProvider(options: OidcOptions): Promise<OidcProvider> {
 const issuerUrl = new URL(options.issuer);
 if (issuerUrl.protocol !== 'https:' && !(options.allowHttp && ['localhost', '127.0.0.1'].includes(issuerUrl.hostname))) {
  throw new Error('OIDC_ISSUER exige HTTPS. http só é aceito em localhost com OIDC_ALLOW_HTTP=true (desenvolvimento).');
 }
 const discoveryOptions: client.DiscoveryRequestOptions = { timeout: 10 };
 if (issuerUrl.protocol === 'http:') discoveryOptions.execute = [client.allowInsecureRequests];
 if (options.internalOrigin) {
  const from = issuerUrl.origin, to = new URL(options.internalOrigin).origin;
  discoveryOptions[client.customFetch] = (url, init) => fetch(url.startsWith(from) ? to + url.slice(from.length) : url, init as RequestInit);
 }
 const config = await client.discovery(issuerUrl, options.clientId, undefined, client.ClientSecretBasic(options.clientSecret), discoveryOptions);

 return {
  issuer: config.serverMetadata().issuer,
  authorizationUrl: ({ redirectUri, state, nonce, codeChallenge }) => client.buildAuthorizationUrl(config, {
   redirect_uri: redirectUri, scope: 'openid profile email', state, nonce,
   code_challenge: codeChallenge, code_challenge_method: 'S256'
  }),
  async completeLogin(currentUrl, checks) {
   const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: checks.codeVerifier, expectedState: checks.state, expectedNonce: checks.nonce, idTokenExpected: true
   });
   const claims = tokens.claims();
   if (!claims?.sub || claims.sub.length > 255) throw new Error('ID Token sem identidade válida.');
   const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
   return {
    claims: {
     issuer: claims.iss, subject: claims.sub,
     name: text(claims.name, 120) ?? text(claims.preferred_username, 120),
     email: claims.email_verified === true ? text(claims.email, 254) : null
    },
    idToken: tokens.id_token ?? null
   };
  },
  endSessionUrl({ idTokenHint, postLogoutRedirectUri }) {
   if (!config.serverMetadata().end_session_endpoint) return null;
   const params: Record<string, string> = { post_logout_redirect_uri: postLogoutRedirectUri, client_id: options.clientId };
   if (idTokenHint) params.id_token_hint = idTokenHint;
   return client.buildEndSessionUrl(config, params);
  }
 };
}

export const pkce = {
 verifier: () => client.randomPKCECodeVerifier(),
 challenge: (verifier: string) => client.calculatePKCECodeChallenge(verifier),
 state: () => client.randomState(),
 nonce: () => client.randomNonce()
};
