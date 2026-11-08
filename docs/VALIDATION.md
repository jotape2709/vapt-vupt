# Validação da continuação — 08/11/2026

Execução verificada: https://github.com/jotape2709/vapt-vupt/actions/runs/42515331885
Commit de código: 45b1b0fd4d4f4998e5f14fdec1abc081166cc839.

| Check | Resultado verificado |
|---|---|
| npm ci | Concluído |
| npm audit --json | 0 vulnerabilidades reportadas |
| npm run lint / npm run build | Aprovados |
| npm run db:migrate | 001 e 002 aplicadas |
| npm test | 10 aprovados, 0 ignorados (inclui PostgreSQL) |
| npm run test:browser | 8 aprovados, desktop/celular |
| npm run test:connected | 4 aprovados, desktop/celular, OIDC/API simulados |
| npm run format:check | Aprovado localmente |

A bateria conectada valida PKCE S256, perfil somente consulta, ausência de tokens no sessionStorage e replay com mesmo UUID/payload após perder resposta. Recarga e novo login antes do replay também passaram. O check do HEAD inclui ainda o cenário de outro operador movimentar o estoque antes de uma confirmação antiga retornar. O provedor simulado fica exclusivamente nos testes. Não há bypass de autenticação no aplicativo.

O executor local ficou disponível nesta retomada. Build, lint e os testes sem banco passaram localmente (9 aprovados e 1 PostgreSQL explicitamente ignorado). O banco real, as migrações e os testes de navegador foram executados no runner GitHub. Inspeção visual do site e do painel azul feita na prévia local pelo navegador.

Continuam pendentes homologação com provedor real, acessibilidade completa/leitores de tela, gestão de membros, provisionamento comercial, recuperação entre dispositivos e fase D. A prévia está sem OIDC configurado, portanto oferece demonstração e informa indisponibilidade do acesso conectado.

Arquivos e decisões da continuação estão em DELIVERY.md, BRAND.md e CONNECTED_ACCESS.md. A main e a licença original foram preservadas.

---

## Histórico da primeira entrega

# Registro de validação — 6 de novembro de 2026

## Resultado verificado

Execução: https://github.com/jotape2709/vapt-vupt/actions/runs/42277769963
Commit testado: 179ea5ef00c9e332e669264b42af1e4e9cf3a7cc.
Runner hospedado GitHub, Node 22, PostgreSQL 17 e Chromium Playwright. Logs consultados após conclusão.

| Comando / verificação | Resultado |
|---|---|
| npm install (bootstrap; agora npm ci com lock commitado) | Concluído |
| npm audit --json | 0 vulnerabilidades reportadas |
| npm run lint | Aprovado |
| npm run build (tsc --noEmit + vite build) | Aprovado |
| npm run db:migrate | Migration 001 aplicada |
| npm test | 7 aprovados, 0 falhas, 0 ignorados |
| npm run test:browser | 4 aprovados: 2 desktop + 2 mobile |
| Integração Vercel da branch | Prévia gerada; sem promoção à produção |

Os testes PostgreSQL usam papel sem SUPERUSER/BYPASSRLS e verificam leitura isolada, acesso negado a outro tenant, bloqueio de viewer, replay concorrente sem duplicação, conflito de payload, conflito de versão, saída inválida com rollback e limpeza do contexto tenant ao retornar a conexão ao pool.

Os testes de interface percorrem três empresas, checam tema e nome, registram entrada, pesquisam saldo, salvam personalização e recarregam, verificam ausência de erro JavaScript e overflow horizontal nos tamanhos testados. Um segundo fluxo rejeita saída acima do saldo e fecha modal por Escape.

Screenshots de site e três empresas em 1440×1000 e 390×844 estão no artefato de CI next-build-and-resolved-lock. Screenshots gerados não equivalem a inspeção visual completa.

## Falhas encontradas e corrigidas

- Primeiro relatório npm audit: 7 alertas moderados derivados de minimatch no parser de lint. Override para 11.0.1; relatório posterior sem vulnerabilidades. Audit agora bloqueia o workflow.
- Primeiro teste de saída no browser: seletor de operação tinha rotulagem ambígua para busca exata. aria-label explícito no controle; reteste aprovado.
- Conta privilegiada de banco agora é rejeitada no startup da API.
- ESLint 9 emitiu aviso de fim de suporte. Migração de major do tooling é pendência de manutenção, separada da auditoria de vulnerabilidades. Não equivale a liberação comercial.

## Ambiente e limitações

O executor local permaneceu indisponível: tentativa de pwd retornou No usable execution environment is available. Os comandos acima foram de fato executados no GitHub Actions, não localmente. Navegador conectado retornou erro de acesso HTTP 401 da ferramenta; nenhuma revisão visual manual foi declarada.

Prévia da branch: https://vapt-vupt-git-next-foundation-product-joao3007s-projects.vercel.app
A prévia contém somente site e demo. Não expõe API operacional nem credenciais reais.

Ainda pendentes: auditoria WCAG/leitor de tela, validação com público-alvo, testes em outros navegadores/dispositivos, provedor OIDC real, UI integrada, logos remotos, estoque por unidade e validação operacional. D/E não executadas.

## Reproduzir

```bash
npm ci
npm audit
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

Para incluir integração PostgreSQL, use banco **descartável**, rode migration e defina TEST_ADMIN_DATABASE_URL. Sem essa variável o teste de banco é explicitamente ignorado. Não use banco de produção.

O lockfile foi recuperado da instalação desta execução e commitado para tornar npm ci reprodutível. O commit de documentação/lock terá execução adicional automática; consultar o check associado ao HEAD antes de merge.
