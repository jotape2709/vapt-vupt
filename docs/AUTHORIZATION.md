# Organizações, funções e permissões (ciclo 02)

O servidor decide a quais empresas a pessoa tem acesso e com qual função. O `organizationId` que vem na URL é só um pedido: cada operação abre uma transação, confere a membership `(organização, issuer, subject)` no banco e só então define `app.org_id` para a RLS. “Sem membership” e “sem permissão” recebem a mesma resposta `403 forbidden`, para não revelar se a empresa existe.

## Matriz de permissões

Fonte única: `roleMatrix` em `packages/domain/contracts.ts`, usada pela API (autorização) e pela interface (esconder ações). A interface **não** é a barreira; a API recusa mesmo quando a chamada é feita à mão (testado em `tests/api.integration.test.ts` e `tests/e2e-real`).

| Permissão | Consulta (`viewer`) | Operador (`operator`) | Gestor (`manager`) | Proprietário (`owner`) |
|---|:-:|:-:|:-:|:-:|
| Ver contexto, estoque, catálogo e histórico (`stock.read`) | ✓ | ✓ | ✓ | ✓ |
| Registrar entrada/saída (`stock.move`) | | ✓ | ✓ | ✓ |
| Cadastrar produto (`product.create`) | | | ✓ | ✓ |
| Aparência, navegação (página inicial), visão geral e categorias sugeridas (`settings.appearance`) | | | ✓ | ✓ |
| Identidade da empresa: nome, segmento, logotipo e módulos do menu (`settings.identity`, `logo.upload`) | | | | ✓ |
| Preferências pessoais (modo, densidade, fonte) | ✓ | ✓ | ✓ | ✓ |

Preferências pessoais pertencem à pessoa (`users.preferences`), não à empresa, e não dão permissão nenhuma. Módulos ligados ou desligados mudam a navegação, **não** a autorização: desligar “Movimentações” não impede um operador de registrar pela API, e nenhuma configuração aceita campos de função ou permissão (o esquema é fechado). Testado em `tests/api.integration.test.ts` (“personalização não concede acesso”). Até o lote 1 este documento atribuía os módulos ao gestor; o código sempre os tratou como identidade da empresa (só proprietário), e o documento foi corrigido.

Edição direta do saldo não existe para nenhuma função: o saldo só muda por movimentação registrada.

## Gestão de membros

Não há tela de convites nem endpoint público para criar empresas ou conceder funções nesta fase. O provisionamento é **administrativo, transacional e auditado** pelo comando `npm run admin` (veja [LOCAL-DEV.md](LOCAL-DEV.md#administração)):

- `provision`: cria organização, configuração v1 a partir do modelo do segmento, unidade principal, membership de proprietário e registro `org.provisioned` em `audit_log`, numa só transação.
- `grant` / `revoke`: concede, altera ou remove uma função, com auditoria.
- `revoke-sessions`: encerra as sessões de uma pessoa.

O comando usa a conta de migração/administração (`ADMIN_DATABASE_URL`), nunca a de runtime.

## Unidades

Piloto com **uma unidade por empresa** (`unitPolicy: 'single-unit-pilot'`), mostrada no topo e no rodapé das tabelas. Catálogo é por organização; saldo é por unidade (`stock_levels`). Não há saldo consolidado, transferência ou escolha de unidade.

## Defesa em profundidade no banco

- RLS com `FORCE` em todas as tabelas de domínio, filtrando por `app.org_id` (local à transação).
- A API roda como `vv_runtime` (membro de `vv_app`): sem superusuário, sem `BYPASSRLS`, sem ownership. `server.ts` recusa iniciar se o papel puder ignorar a RLS.
- Grants mínimos em `db/grants/runtime.sql`: `UPDATE` apenas em colunas específicas; nenhum `UPDATE/DELETE` em movimentações, auditoria ou versões de configuração (também bloqueados por gatilhos append-only).
- Chaves compostas `(organization_id, id)` impedem referência cruzada entre empresas.
