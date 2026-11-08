import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  allowedPath,
  buildIndex,
  search,
  snapshot,
  changedFiles,
  contextPack,
} from "./project-context.mjs";

test("corpus excludes environment, history, cache, path traversal and private instructions", () => {
  for (const path of [
    ".env",
    ".env.example",
    "apps/.env.local",
    "legacy/app.ts",
    "node_modules/a.ts",
    ".context/cache.json",
    "docs/../.env",
    "/tmp/readme.md",
    "CLAUDE.local.md",
    "docs/a\nfile.md",
  ])
    assert.equal(allowedPath(path), false, path);
  for (const path of [
    "apps/api/repository.ts",
    "docs/context/PROJECT_STATE.md",
    "AGENTS.md",
    ".agents/rules/vapt-vupt.md",
  ])
    assert.equal(allowedPath(path), true, path);
});

test("retrieval cites sections/lines, detects edits/additions/removal and never reads escaped symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "vv-context-"));
  const outside = await mkdtemp(join(tmpdir(), "vv-outside-"));
  try {
    await mkdir(join(root, "apps"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "apps", "inventory.ts"),
      'export function recordMovement() {\n // Estoque, idempotência, UUID, expectedVersion e replay.\n return "confirmed";\n}\n',
    );
    await writeFile(
      join(root, "docs", "guide.md"),
      "# Operação\n## Estoque\nMovimentação com saldo e conflito explícito.\n## Identidade\nTokens apenas em memória.\n",
    );
    await writeFile(join(root, ".env"), "TOP_SECRET_DO_NOT_READ");
    await writeFile(join(outside, "stolen.ts"), "TOP_SECRET_DO_NOT_READ");
    let linked = false;
    try {
      await symlink(
        join(outside, "stolen.ts"),
        join(root, "apps", "linked.ts"),
      );
      linked = true;
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOSYS"].includes(error.code)) throw error;
    }
    const paths = [
      "apps/inventory.ts",
      "docs/guide.md",
      ".env",
      ...(linked ? ["apps/linked.ts"] : []),
    ];
    const first = await buildIndex(root, paths);
    assert.equal(first.files.length, 2);
    assert.equal(
      JSON.stringify(first).includes("TOP_SECRET_DO_NOT_READ"),
      false,
    );
    const result = search(first, "idempotência replay");
    assert.equal(result[0].path, "apps/inventory.ts");
    assert.equal(result[0].startLine, 1);
    assert.ok(
      search(first, "tokens memória").some(
        (r) => r.title === "Operação > Identidade",
      ),
    );
    assert.deepEqual(search(first, "zzzznonexistentzzzz"), []);
    const pack = contextPack(first, "estoque idempotência", 3000);
    assert.ok(pack.includes("apps/inventory.ts:1-"));
    assert.ok(pack.includes("SHA-256:"));
    assert.ok(pack.length <= 3000);
    assert.deepEqual(changedFiles(snapshot(first), first), []);
    await writeFile(
      join(root, "apps", "inventory.ts"),
      "export const quantity = 9;\n",
    );
    const edited = await buildIndex(root, paths);
    assert.deepEqual(changedFiles(snapshot(first), edited), [
      "apps/inventory.ts",
    ]);
    const removed = await buildIndex(root, ["apps/inventory.ts"]);
    assert.ok(changedFiles(snapshot(first), removed).includes("docs/guide.md"));
    await writeFile(join(root, "apps", "new.ts"), "export const added = true;");
    const added = await buildIndex(root, [...paths, "apps/new.ts"]);
    assert.ok(changedFiles(snapshot(first), added).includes("apps/new.ts"));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("LF and CRLF clones produce the same digest", async () => {
  const root = await mkdtemp(join(tmpdir(), "vv-newlines-"));
  try {
    await writeFile(join(root, "README.md"), "# Context\nCurrent source.\n");
    const unix = await buildIndex(root, ["README.md"]);
    await writeFile(
      join(root, "README.md"),
      "# Context\r\nCurrent source.\r\n",
    );
    const windows = await buildIndex(root, ["README.md"]);
    assert.equal(unix.digest, windows.digest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Markdown code fences do not create false document headings", async () => {
  const root = await mkdtemp(join(tmpdir(), "vv-headings-"));
  try {
    await writeFile(
      join(root, "README.md"),
      "# Produto\n```bash\n# Isto é comentário de shell\n```\n## Estoque\nSaldo atual.\n",
    );
    const index = await buildIndex(root, ["README.md"]);
    assert.ok(index.chunks.some((c) => c.title === "Produto > Estoque"));
    assert.ok(
      index.chunks.every((c) => !c.title.includes("comentário de shell")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("real repository task queries retrieve implementation and current decisions", async () => {
  const index = await buildIndex();
  for (const [query, path] of [
    ["replay idempotência expectedVersion estoque", "apps/api/repository.ts"],
    ["tema azul personalização", "docs/BRAND.md"],
    ["OIDC PKCE autenticação", "apps/web/auth.ts"],
    ["offline PWA intranet", "docs/ARCHITECTURE.md"],
  ]) {
    const results = search(index, query, 6);
    assert.ok(
      results.some((r) => r.path === path),
      query + " did not retrieve " + path,
    );
    assert.ok(
      results[0].path !== "scripts/project-context.mjs",
      query + " retrieved its own dictionary",
    );
  }
});
