import { test } from "node:test";
import assert from "node:assert/strict";
import {
  savePending,
  readPending,
  clearPending,
} from "../apps/web/pending-operation";
test("recibo mantém UUID/conteúdo através de recarga e separa identidades", () => {
  const entries = new Map<string, string>();
  const store = {
    getItem: (k: string) => entries.get(k) || null,
    setItem: (k: string, v: string) => {
      entries.set(k, v);
    },
    removeItem: (k: string) => {
      entries.delete(k);
    },
  };
  const op = {
    org: "10000000-0000-4000-8000-000000000001",
    event: {
      eventId: "10000000-0000-4000-8000-000000000002",
      productId: "10000000-0000-4000-8000-000000000003",
      kind: "receipt" as const,
      quantity: 3,
      expectedVersion: 0,
      reason: "Recebimento",
    },
  };
  savePending(store, "issuer", "alice", op);
  assert.deepEqual(readPending(store, "issuer", "alice"), op);
  assert.equal(readPending(store, "issuer", "bob"), null);
  assert.equal(readPending(store, "other", "alice"), null);
  assert.throws(() =>
    savePending(store, "issuer", "alice", {
      ...op,
      event: { ...op.event, quantity: -1 },
    }),
  );
  clearPending(store, "issuer", "alice");
  assert.equal(readPending(store, "issuer", "alice"), null);
});
