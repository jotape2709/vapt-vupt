import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMovement,
  ThemeSchema,
  may,
  MovementSchema,
} from "../packages/domain";
const event = {
  eventId: "00000000-0000-4000-8000-000000000001",
  productId: "00000000-0000-4000-8000-000000000002",
  expectedVersion: 0,
  kind: "issue" as const,
  quantity: 3,
  reason: "Teste de saída",
};
test("saída não pode criar saldo negativo", () =>
  assert.throws(() => applyMovement(2, event)));
test("entrada soma e saída subtrai", () => {
  assert.equal(applyMovement(5, event), 2);
  assert.equal(applyMovement(5, { ...event, kind: "receipt" }), 8);
});
test("quantidades fracionárias, zero e negativas são rejeitadas", () => {
  for (const quantity of [0, -1, 0.5, Infinity])
    assert.equal(
      MovementSchema.safeParse({ ...event, quantity }).success,
      false,
    );
});
test("viewer não move nem configura; operador não configura", () => {
  assert.equal(may("viewer", "move"), false);
  assert.equal(may("operator", "configure"), false);
  assert.equal(may("manager", "configure"), true);
});
test("tema rejeita CSS, chaves de autorização e SVG ativo", () => {
  const theme = {
    version: 2,
    name: "Mercado",
    accent: "blue",
    mode: "light",
    density: "compact",
    font: "system",
    modules: ["overview"],
  };
  assert.equal(ThemeSchema.safeParse(theme).success, true);
  for (const extra of [
    { accent: "url(javascript:alert(1))" },
    { role: "owner" },
    { logo: "data:image/svg+xml;base64,PHN2Zz4=" },
  ])
    assert.equal(ThemeSchema.safeParse({ ...theme, ...extra }).success, false);
});
