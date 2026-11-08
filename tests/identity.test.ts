import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import { tokenVerifier } from "../apps/api/identity";

test("identidade: assinatura, issuer, audience, expiração e idade do token", async () => {
  const key = await generateKeyPair("ES256");
  const jwk = await exportJWK(key.publicKey);
  jwk.kid = "test-key";
  const verify = tokenVerifier(createLocalJWKSet({ keys: [jwk] }), {
    issuer: "https://identity.test",
    audience: "vv-api",
  });
  const sign = (claims: Record<string, unknown> = {}) =>
    new SignJWT({
      sub: "alice",
      iss: "https://identity.test",
      aud: "vv-api",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      ...claims,
    })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .sign(key.privateKey);
  assert.deepEqual(await verify(await sign()), {
    subject: "alice",
    issuer: "https://identity.test",
  });
  for (const claims of [
    { iss: "https://other.test" },
    { aud: "other-api" },
    { exp: 1 },
    { iat: 1 },
    { sub: "" },
  ])
    await assert.rejects(() => sign(claims).then(verify));
  const other = await generateKeyPair("ES256");
  const forged = await new SignJWT({
    sub: "alice",
    iss: "https://identity.test",
    aud: "vv-api",
  })
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(other.privateKey);
  await assert.rejects(() => verify(forged));
});
