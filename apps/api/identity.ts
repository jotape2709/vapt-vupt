import { jwtVerify, type JWTVerifyGetKey } from "jose";

export function tokenVerifier(
  jwks: JWTVerifyGetKey,
  config: { issuer: string; audience: string },
) {
  return async (token: string) => {
    const { payload } = await jwtVerify(token, jwks, {
      ...config,
      algorithms: ["RS256", "ES256"],
      requiredClaims: ["sub", "iss", "aud", "exp", "iat"],
      maxTokenAge: "15m",
    });
    if (!payload.sub || payload.sub.length > 255)
      throw new Error("Identidade inválida");
    return { subject: payload.sub, issuer: config.issuer };
  };
}
