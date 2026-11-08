import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import {
  MovementSchema,
  ProductSchema,
  ThemeSchema,
} from "../../packages/domain";
import { AccessError, type Identity, type Repository } from "./repository";
type Data = Pick<
  Repository,
  | "organizations"
  | "movements"
  | "products"
  | "createProduct"
  | "configure"
  | "move"
>;
export function buildApi(
  repo: Data,
  verify: (token: string) => Promise<Identity>,
) {
  const app = Fastify({
    bodyLimit: 200000,
    logger: { redact: ["req.headers.authorization", "req.headers.cookie"] },
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.register(helmet);
  app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.get("/health", async () => ({ status: "ok", scope: "process-only" }));
  app.register(
    async (secured) => {
      secured.addHook("onRequest", async (req, reply) => {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
          return reply.code(401).send({ error: "Autenticação necessária." });
        }
        try {
          identities.set(req, await verify(header.slice(7)));
        } catch {
          return reply
            .code(401)
            .send({ error: "Credencial inválida ou expirada." });
        }
      });
      secured.get("/me/organizations", async (req) =>
        repo.organizations(identities.get(req)!),
      );
      secured.get("/organizations/:orgId/movements", async (req) =>
        repo.movements(
          identities.get(req)!,
          z.object({ orgId: z.string().uuid() }).parse(req.params).orgId,
        ),
      );
      const params = z.object({ orgId: z.string().uuid() });
      secured.get("/organizations/:orgId/products", async (req) =>
        repo.products(identities.get(req)!, params.parse(req.params).orgId),
      );
      secured.post("/organizations/:orgId/products", async (req, reply) => {
        const result = await repo.createProduct(
          identities.get(req)!,
          params.parse(req.params).orgId,
          ProductSchema.parse(req.body),
        );
        return reply.code(201).send(result);
      });
      secured.put("/organizations/:orgId/theme", async (req) =>
        repo.configure(
          identities.get(req)!,
          params.parse(req.params).orgId,
          ThemeSchema.parse(req.body),
        ),
      );
      secured.post("/organizations/:orgId/movements", async (req) =>
        repo.move(
          identities.get(req)!,
          params.parse(req.params).orgId,
          MovementSchema.parse(req.body),
        ),
      );
    },
    { prefix: "/api" },
  );
  const identities = new WeakMap<object, Identity>();
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({ error: "Dados inválidos." });
    if (error instanceof AccessError)
      return reply.code(error.statusCode).send({ error: error.message });
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return reply.code(409).send({ error: "Registro já existente." });
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500)
      return reply.code(statusCode).send({ error: "Solicitação rejeitada." });
    app.log.error({ err: error }, "Falha na operação");
    return reply
      .code(500)
      .send({ error: "Não foi possível concluir a operação." });
  });
  return app;
}
