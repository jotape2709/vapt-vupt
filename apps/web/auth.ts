import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
} from "oidc-client-ts";

const authority = import.meta.env.VITE_OIDC_AUTHORITY as string | undefined;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined;
export const authConfigured = Boolean(
  authority &&
    clientId &&
    (() => {
      try {
        return new URL(authority).protocol === "https:";
      } catch {
        return false;
      }
    })(),
);
let instance: UserManager | undefined;
let callback: ReturnType<UserManager["signinRedirectCallback"]> | undefined;

export function identityClient() {
  if (!authority || !clientId)
    throw new Error("Acesso da empresa ainda não configurado.");
  if (new URL(authority).protocol !== "https:")
    throw new Error("O acesso exige uma conexão segura.");
  instance ??= new UserManager({
    authority,
    client_id: clientId,
    response_type: "code",
    scope: "openid profile",
    redirect_uri: new URL("/auth/callback", window.location.origin).href,
    // Only the PKCE interaction state survives the redirect. Tokens stay in memory.
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    automaticSilentRenew: false,
    monitorSession: false,
    loadUserInfo: false,
  });
  return instance;
}

export async function startSignIn() {
  const client = identityClient();
  await client.clearStaleState();
  await client.signinRedirect();
}

export function finishSignIn() {
  // StrictMode may mount twice. Consume an authorization code only once.
  callback ??= identityClient()
    .signinRedirectCallback()
    .finally(() => {
      window.history.replaceState({}, "", "/app");
    });
  return callback;
}

export async function accessToken() {
  const user = await identityClient().getUser();
  if (!user || user.expired)
    throw new Error("Sua sessão terminou. Entre novamente.");
  return user.access_token;
}

export async function endLocalSession() {
  await identityClient().removeUser();
}
