import { z } from "zod";
import { MovementSchema } from "../../packages/domain";
const ReceiptSchema = z
  .object({ org: z.string().uuid(), event: MovementSchema })
  .strict();
export type PendingOperation = z.infer<typeof ReceiptSchema>;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
// A receipt of an online submission, not an offline command queue. No tokens.
const key = (issuer: string, subject: string) =>
  "vv-pending-v1:" + JSON.stringify([issuer, subject]);
export function savePending(
  store: Store,
  issuer: string,
  subject: string,
  operation: PendingOperation,
) {
  store.setItem(
    key(issuer, subject),
    JSON.stringify(ReceiptSchema.parse(operation)),
  );
}
export function readPending(
  store: Store,
  issuer: string,
  subject: string,
): PendingOperation | null {
  const raw = store.getItem(key(issuer, subject));
  if (!raw) return null;
  return ReceiptSchema.parse(JSON.parse(raw));
}
export function clearPending(store: Store, issuer: string, subject: string) {
  store.removeItem(key(issuer, subject));
}
