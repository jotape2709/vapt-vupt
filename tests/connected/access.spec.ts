// Simulated OIDC issuer and API, never a bypass in the application.
// PostgreSQL isolation and JWT cryptography have their own real integration tests.
import { test, expect, type Page } from "@playwright/test";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
const org = "10000000-0000-4000-8000-000000000001";
const productId = "10000000-0000-4000-8000-000000000002";
async function fixture(page: Page, role: "manager" | "viewer" = "manager") {
  const pair = await generateKeyPair("ES256");
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = "fixture";
  let nonce: string | null = null,
    quantity = 10,
    version = 0;
  const events: Array<Record<string, unknown>> = [];
  const calls: Array<Record<string, unknown>> = [];
  const headers = {
    "access-control-allow-origin": "http://127.0.0.1:4173",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST,GET,OPTIONS",
  };
  await page.route("https://identity.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname === "/.well-known/openid-configuration")
      return route.fulfill({
        json: {
          issuer: "https://identity.test",
          authorization_endpoint: "https://identity.test/authorize",
          token_endpoint: "https://identity.test/token",
          jwks_uri: "https://identity.test/jwks",
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["ES256"],
        },
        headers,
      });
    if (url.pathname === "/authorize") {
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      nonce = url.searchParams.get("nonce");
      return route.fulfill({
        status: 302,
        headers: {
          location:
            "http://127.0.0.1:4173/auth/callback?code=fixture&state=" +
            encodeURIComponent(url.searchParams.get("state")!),
        },
      });
    }
    if (url.pathname === "/jwks")
      return route.fulfill({ json: { keys: [jwk] }, headers });
    if (url.pathname === "/token") {
      expect(
        new URLSearchParams(route.request().postData() || "").get(
          "code_verifier",
        ),
      ).toBeTruthy();
      const token = await new SignJWT({
        sub: "fixture-user",
        iss: "https://identity.test",
        aud: "vapt-test",
        ...(nonce ? { nonce } : {}),
      })
        .setProtectedHeader({ alg: "ES256", kid: "fixture" })
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(pair.privateKey);
      return route.fulfill({
        json: {
          access_token: "fixture-access-token",
          token_type: "Bearer",
          expires_in: 300,
          id_token: token,
        },
        headers,
      });
    }
    return route.abort();
  });
  const product = () => ({
    id: productId,
    name: "Arroz teste",
    sku: "TST-1",
    unit: "un",
    quantity,
    minimum: 5,
    category: "Mercearia",
    version,
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    expect(req.headers().authorization).toBe("Bearer fixture-access-token");
    if (path === "/api/me/organizations")
      return route.fulfill({
        json: [
          {
            id: org,
            name: "Empresa autorizada",
            role,
            theme: {
              version: 2,
              name: "Empresa autorizada",
              accent: "blue",
              mode: "light",
              density: "comfortable",
              font: "system",
              modules: ["overview", "inventory", "products", "movements"],
            },
          },
        ],
      });
    if (path === "/api/organizations/" + org + "/products")
      return route.fulfill({ json: [product()] });
    if (
      path === "/api/organizations/" + org + "/movements" &&
      req.method() === "GET"
    )
      return route.fulfill({ json: events });
    if (
      path === "/api/organizations/" + org + "/movements" &&
      req.method() === "POST"
    ) {
      const event = req.postDataJSON() as Record<string, unknown>;
      calls.push(event);
      if (calls.length === 1) {
        quantity += Number(event.quantity);
        version++;
        events.push({
          id: event.eventId,
          product: "Arroz teste",
          kind: "receipt",
          quantity: event.quantity,
          reason: event.reason,
          at: new Date().toISOString(),
        });
        return route.abort("failed");
      }
      return route.fulfill({
        json: {
          eventId: event.eventId,
          quantity,
          version,
          status: "confirmed",
          replayed: true,
        },
      });
    }
    return route.fulfill({
      status: 403,
      json: { error: "Acesso não permitido." },
    });
  });
  await page.goto("/app");
  await page.getByRole("button", { name: "Entrar com segurança" }).click();
  await expect(page.getByLabel("Selecionar empresa autorizada")).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Arroz teste" }),
  ).toBeVisible();
  return calls;
}
test("PKCE e perda de resposta preservam o evento até confirmar replay", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page
    .getByRole("button", { name: "Registrar movimentação", exact: true })
    .click();
  await page.getByLabel("Quantidade", { exact: true }).fill("3");
  await page.getByLabel("Motivo", { exact: true }).fill("Recebimento teste");
  await page.getByRole("button", { name: "Confirmar movimentação" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verificar confirmação" }),
  ).toBeVisible();
  await expect(
    page.getByText("Movimentação confirmada pelo servidor."),
  ).toHaveCount(0);
  const stored = await page.evaluate(() => Object.entries(sessionStorage));
  expect(JSON.stringify(stored)).not.toContain("fixture-access-token");
  // Reload drops in-memory tokens; the receipt must survive a fresh PKCE login.
  await page.reload();
  await page.getByRole("button", { name: "Entrar com segurança" }).click();
  await expect(
    page.getByRole("button", { name: "Verificar confirmação" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Verificar confirmação" }).click();
  await expect(
    page.getByText("Movimentação confirmada pelo servidor."),
  ).toBeVisible();
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  await expect(
    page.getByRole("cell", { name: "13 un", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((k) => k.startsWith("vv-pending")),
    ),
  ).toBe(false);
});
test("consulta não oferece ações de escrita", async ({ page }) => {
  await fixture(page, "viewer");
  await expect(
    page.getByRole("button", { name: "Registrar movimentação", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Novo produto", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Encerrar sessão no aplicativo" })
    .click();
  await expect(
    page.getByRole("button", { name: "Entrar com segurança" }),
  ).toBeVisible();
  await expect(page.getByText("Arroz teste")).toHaveCount(0);
});
