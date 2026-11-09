# UX — ciclo 01: fluxo de estoque do mercado demonstrativo

Escopo: experiência demonstrativa de um pequeno mercado (Mercado Aurora), preservando Adega Vértice e Bar da Esquina. Fluxo-alvo: **encontrar ou cadastrar produto → registrar entrada/saída → conferir saldo e histórico**.

Base auditada: `main` em `1d9fb99` (PR #9), lida em 09/11/2026. Evidências: leitura de `apps/web/*`, `packages/domain`, testes e capturas Playwright em 1440 × 1000 e 390 × 844 (`docs/review/ux-cycle-01/before-*.png`).

## 1. Problemas encontrados (antes)

Prioridade: **P1** bloqueia ou confunde o fluxo principal; **P2** atrito relevante; **P3** acabamento.

| # | Prioridade | Onde | Problema | Evidência |
|---|---|---|---|---|
| 1 | P1 | Estoque / Produtos | As duas páginas renderizam a mesma tabela; só muda o botão do cabeçalho. Não há ação a partir de um produto: para movimentar é preciso abrir o diálogo genérico e procurar o item de novo num `select`. | `App.tsx`, bloco `['inventory','products'].includes(page)` |
| 2 | P1 | Busca sem resultado | Mostra apenas "Nenhum produto encontrado". Não oferece limpar a busca nem cadastrar o termo procurado: o fluxo "encontrar **ou** cadastrar" quebra exatamente onde deveria continuar. | captura `before-d-busca-vazia.png` |
| 3 | P1 | Histórico | Saldos são salvos no navegador, mas o histórico é descartado no recarregamento (`movements: []` ao carregar e salvar). Depois de recarregar, o saldo mudou sem nenhum registro que explique a mudança. | `demo.ts` (`loadDemo`, `saveDemo`) |
| 4 | P1 | Celular, Estoque | Em 390 px a tabela mostra só produto e categoria; saldo, mínimo e situação ficam fora da área visível, e a coluna Categoria ocupa o espaço mais valioso. | `before-m-estoque.png` |
| 5 | P2 | Movimentação | Operação num `select`, sem prévia do saldo resultante. O botão diz "Registrar na demonstração" para entrada e saída. Validação genérica, só depois do envio, sem indicar o campo nem mover o foco. Motivo sem sugestões. | `before-d-dialogo.png` |
| 6 | P2 | Confirmação | Depois de registrar, o diálogo fecha e a única mensagem é "Alteração demonstrativa salva neste navegador.", igual para qualquer alteração. Não diz o que mudou nem o novo saldo. | `App.tsx`, `commit()` |
| 7 | P2 | Cadastro | Após salvar um produto (saldo 0), não há caminho direto para registrar a primeira entrada. Mensagem de erro única ("Confira os campos do produto."). | `ProductForm` |
| 8 | P2 | Diálogo em modo escuro | O `dialog` redefine tokens claros fixos; na Adega (escura) o diálogo fica branco com botão azul-claro de baixo contraste. | `before-d-adega-dialogo.png`, `styles.css` regra `dialog{--bg:#f4f7fc…}` |
| 9 | P2 | Foco do diálogo | Ao abrir, o foco cai no botão "×", não no primeiro campo. Se o elemento de origem deixar de existir, o foco se perde no `body`. | inspeção via Playwright |
| 10 | P2 | Empresa ativa / demonstração | Cabeçalho mostra "MERCADO / OPERAÇÃO"; a empresa ativa aparece só no topo e no seletor. A faixa diz "Sem conexão com servidor", que soa como erro de rede em vez de característica da demonstração. A troca de empresa não é anunciada. | capturas `before-*-overview.png` |
| 11 | P2 | Busca | Sensível a acentos: "cafe" não encontra "Café torrado". | `toLocaleLowerCase` sem normalização |
| 12 | P2 | Empresa sem produtos | O diálogo de movimentação abre com `select` vazio e botão desabilitado, sem explicar o próximo passo. | criar empresa demo → Registrar movimentação |
| 13 | P3 | CSS | Bloco final "Responsive corrections" repete e contradiz regras anteriores (duas `@media(max-width:760px)`, tokens da marca definidos no fim do arquivo). | `styles.css` |
| 14 | P3 | Código | `App.tsx` concentra páginas, formulários e regras em linhas de centenas de caracteres; difícil revisar e testar. | `App.tsx` |
| 15 | P3 | Nota do dia no modo escuro | Cartão azul-claro muito luminoso sobre fundo escuro, competindo com a lista de reposição. | `before-d-adega-dialogo.png` |

## 2. Divergências do README em relação ao código (antes)

| README dizia | Código / histórico | Correção |
|---|---|---|
| "Vapt-Vupt Next" | Nome do produto é Vapt-Vupt | Removido o rótulo em todo o produto |
| `git switch next/foundation-product` | A branch foi integrada pela PR #7; o trabalho atual parte da `main` | Instrução removida |
| Lockfile "ainda precisa ser gerado" e CI com `npm install` | Sem lockfile no repositório | `package-lock.json` gerado e validado; CI com `npm ci` |
| Workflow "Next foundation checks" disparado na branch de fundação | Branch não existe mais como alvo | Workflow "Vapt-Vupt checks" em `main` e PRs para `main` |
| "histórico só na sessão" | Saldo persistia sem histórico (problema 3) | Histórico demonstrativo persiste no navegador junto com os saldos |
| Testes de navegador não mencionados em "Desenvolvimento" | `npm run test:browser` existe | Comando documentado |
