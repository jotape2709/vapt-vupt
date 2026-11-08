import { z } from "zod";
import {
  ProductSchema,
  ThemeSchema,
  type MovementInput,
  type Product,
} from "../../packages/domain";
import { accessToken } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  theme: ThemeSchema,
  role: z.enum(["owner", "manager", "operator", "viewer"]),
});
export type Organization = z.infer<typeof OrganizationSchema>;
export const StockProductSchema = ProductSchema.extend({
  version: z.number().int().nonnegative(),
});
export type StockProduct = z.infer<typeof StockProductSchema>;
const RecordSchema = z.object({
  id: z.string().uuid(),
  product: z.string(),
  kind: z.enum(["receipt", "issue"]),
  quantity: z.number().positive(),
  reason: z.string(),
  at: z.string(),
});
export type StockRecord = z.infer<typeof RecordSchema>;

async function request(path: string, init: RequestInit = {}) {
  const token = await accessToken().catch(() => {
    throw new ApiError(401, "Sua sessão terminou. Entre novamente.");
  });
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível obter confirmação. Recarregue os dados antes de uma nova operação.",
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(body);
    throw new ApiError(
      response.status,
      error.success
        ? error.data.error
        : "Não foi possível concluir a operação.",
    );
  }
  return body;
}
export const api = {
  organizations: async () =>
    OrganizationSchema.array().parse(await request("/me/organizations")),
  products: async (org: string) =>
    StockProductSchema.array().parse(
      await request("/organizations/" + org + "/products"),
    ),
  movements: async (org: string) =>
    RecordSchema.array().parse(
      await request("/organizations/" + org + "/movements"),
    ),
  createProduct: async (org: string, product: Product) =>
    StockProductSchema.parse(
      await request("/organizations/" + org + "/products", {
        method: "POST",
        body: JSON.stringify(product),
      }),
    ),
  move: async (org: string, event: MovementInput) =>
    z
      .object({
        eventId: z.string().uuid(),
        quantity: z.number(),
        version: z.number(),
        status: z.literal("confirmed"),
      })
      .parse(
        await request("/organizations/" + org + "/movements", {
          method: "POST",
          body: JSON.stringify(event),
        }),
      ),
};
