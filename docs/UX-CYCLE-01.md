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

## 3. Duas composições da tela de estoque

Ambas foram construídas sobre o mesmo código, dados e tokens, com o mesmo registro de entrada aplicado antes da captura. A variante B existiu só como prévia temporária (`?composicao=b`) e foi removida antes do commit; não há duas aplicações.

| | A — tabela com ações na linha | B — lista + painel do produto |
|---|---|---|
| Desktop | `variant-a-d.png` | `variant-b-d.png` |
| Celular | `variant-a-m.png` | `variant-b-m.png` |
| Hierarquia | Todos os saldos e situações lado a lado; o que precisa de reposição salta pela coluna Situação e pelo filtro "Repor". | Um produto por vez em destaque; o saldo grande é ótimo para conferência individual, mas compara mal itens entre si. |
| Legibilidade | Colunas alinhadas à direita para números; leitura em varredura. | Lista legível; no celular a situação some da lista para caber. |
| Densidade | 6 produtos e ações na primeira dobra em 1440 px. | Mesma lista, mas metade da largura vai para um único produto. |
| Operação | 1 toque: Entrada/Saída na própria linha abre o diálogo já preenchido. | 2 toques: selecionar o produto e depois Entrada/Saída. No celular o painel fica abaixo de toda a lista. |
| Acessibilidade | Tabela semântica (`th scope=row`), ações nomeadas por produto, rolagem contida e focável. | Lista de botões com `aria-pressed`; exige gerenciar o foco entre lista e painel. |

**Escolha: A.** O fluxo-alvo é operacional e repetitivo (receber mercadoria, dar saída), então o número de toques e a varredura de saldos pesam mais do que a ênfase num único produto. B só vence ao conferir o histórico de um item; esse ganho foi incorporado a A pelo botão "Ver histórico" da confirmação e pela coluna Histórico em Produtos, sem custar um passo extra no caso comum.

Ajustes feitos depois da escolha, a partir das capturas:

- No celular, a navegação ocupava ~1/3 da primeira tela. Módulos, Personalização e Criar empresa viraram **uma única faixa rolável**, e marca e empresa dividem a mesma linha.
- A coluna de ações fica **fixa à direita** da tabela; o que rola é o meio.
- Abaixo de 400 px, saldo, mínimo e "Repor" vão para a célula do produto e as colunas numéricas saem, para que as ações nunca cubram o saldo (`after-320-estoque.png`).

## 4. O que mudou

| Área | Mudança | Problemas tratados |
|---|---|---|
| Estoque | Saldo, mínimo e situação com Entrada/Saída por linha; filtros em chips com contagem; contagem de resultados anunciada (`role=status`); busca sem acento e por categoria; limpar busca. | 1, 4, 11 |
| Busca sem resultado | "Nenhum produto para “termo”" com **Cadastrar “termo”** (nome ou código pré-preenchido) e Limpar busca. Filtro vazio oferece Mostrar todos. | 2 |
| Produtos | Catálogo com categoria, unidade e Histórico por produto; Novo produto pré-preenche com a busca atual. | 1 |
| Cadastro | Erros por campo, foco no primeiro inválido, código duplicado no próprio campo, categorias existentes sugeridas. Confirmação oferece **Registrar entrada** do produto recém-criado. | 7 |
| Movimentação | Entrada/Saída como alternância; quantidade com unidade; **prévia do saldo** (atual → após); sugestões de motivo; botão "Registrar entrada/saída"; validação por campo com `aria-invalid`/`aria-describedby` e foco. | 5 |
| Confirmação local | "Entrada registrada na demonstração: +24 un de X. Saldo 0 → 24 un." com Ver histórico. Nunca menciona envio ou sincronização. Se o navegador recusar o salvamento, a mensagem diz que a alteração vale só até recarregar. | 6 |
| Histórico | Persiste com os saldos (últimos 200 por empresa); mostra operação, motivo, data/hora, quantidade e saldo antes → depois; filtros por produto e operação. | 3 |
| Empresa ativa | Nome no cabeçalho de cada página e no diálogo; troca anunciada; faixa "Empresa fictícia · dados salvos só neste navegador / Nada é enviado a servidor". | 10 |
| Diálogos | Herdam o tema claro/escuro da empresa; foco inicial no campo certo; foco volta para quem abriu, ou para o conteúdo se a origem sumiu. | 8, 9 |
| Empresa vazia | Visão geral e diálogo orientam a cadastrar o primeiro produto. | 12 |
| Restaurar | Personalização → Restaurar dados de exemplo, com confirmação. | — |
| Código e CSS | `App.tsx` dividido em `pages.tsx`, `forms.tsx`, `components.tsx`, `inventory.ts`; regras de estoque testáveis. CSS com um único conjunto de breakpoints, tokens de perigo/marca no lugar certo, sem bloco de correções no fim. | 13, 14 |
| Modo escuro | Nota do dia usa as superfícies do tema em vez do azul-claro luminoso. | 15 |

Preservado: SVGs e logo VV em fitas, paletas Azul Royal/Marinho/Atlântico, Trebuchet/Georgia, claro/escuro, densidade, personalização e as três empresas.

## 5. Verificação executada (09/11/2026, container Linux, Node 22.23.4, npm 10.9.9)

| Comando | Resultado |
|---|---|
| `npm ci` (instalação limpa a partir do lockfile) | ok |
| `npm audit` | 0 vulnerabilidades |
| `npm run lint` | ok, sem avisos |
| `npm run build` (tsc + vite) | ok |
| `npm test` | 15 testes: 14 aprovados, **1 ignorado** (integração PostgreSQL, sem `TEST_ADMIN_DATABASE_URL` neste ambiente) |
| `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test` | **32 aprovados** (16 cenários × projetos desktop 1440 e mobile 390) |

Cobertura de navegador: fluxo completo busca → cadastro → entrada → histórico → recarregar; código duplicado; teclado (Enter abre, validação foca, Esc fecha e devolve o foco); saída pela linha com prévia e bloqueio acima do saldo; empresa vazia; três empresas em claro e escuro com cor do diálogo igual à superfície do tema; zoom de 200% simulado em 720 × 500; nomes longos em 320 px; larguras 320, 360, 390, 768, 1024 e 1440 px sem rolagem horizontal da página; migração de aliases antigos de cor.

Limitações desta verificação:

- O Chromium do container é a revisão 1243; o `@playwright/test` resolvido (1.65.0) espera a 1254. Os testes rodaram apontando para o binário instalado. O CI usa `npx playwright install` com a revisão correta.
- Zoom de 200% foi simulado por viewport equivalente, não pelo zoom do navegador.
- Sem leitor de tela real nem auditoria automática de contraste (axe/Lighthouse). Foco, nomes acessíveis e descrições foram verificados pelos testes.
- Safari/Firefox e dispositivos físicos não foram testados.
- A integração PostgreSQL só roda no CI.

## 6. O que funciona e o que continua demonstrativo

Funciona na demonstração local: busca, filtros, cadastro, entrada/saída com regra de saldo do domínio, histórico persistido no navegador, três empresas com temas, empresa nova, restauração dos dados, claro/escuro e responsividade testada.

Continua demonstrativo: tudo fica no `localStorage` do navegador; não há login, servidor, sincronização, multiusuário nem trilha de auditoria. Compras, cotações e equipe são telas de status planejado. A API Fastify/PostgreSQL existe, mas a UI ainda não a usa.

## 7. Próximas etapas (backlog, não iniciadas)

1. Conectar a UI à API: login OIDC, organização/unidade reais, produtos e movimentações persistidos, `expectedVersion` e idempotência reais, testes de isolamento entre empresas.
2. Seletor de produto pesquisável no diálogo (catálogos grandes) e leitura de código de barras/GTIN.
3. Quantidades fracionárias e embalagens (kg, caixa com N unidades).
4. Desfazer/estornar movimentação com registro próprio (hoje não há estorno).
5. Auditoria de acessibilidade com leitor de tela e axe; testes em Safari/Firefox.
6. PWA/offline, política de conflitos e intranet (fase D).
7. Compras, cotações, POS e integrações com caixa (fase E).
8. Câmeras/visão computacional e IA de reposição: fora da primeira entrega.
