# Registro de validação

## Ciclo 02, lote 3 (hospedagem em nuvem) — 2026-11-09

Executado de fato: build da imagem de produção (`deploy/cloud/Dockerfile`) e ensaio isolado `deploy/cloud/test/drill.sh` com essa imagem reconstruída do zero. O ensaio cobriu:

- recusas de modelo e de senha de desenvolvimento;
- instalação limpa com proxy TLS (CA de teste);
- login OIDC real no navegador;
- cadastro e entrada;
- exposição de rede;
- reinício do banco, da API e de todos os contêineres;
- backup cifrado enviado a um S3 falso;
- atualização com reversão automática;
- perda total do servidor;
- ensaio de restauração em projeto separado, recuperação com novo login e exportação da empresa;
- logs sem segredos.

Também passaram: `npm test` com PostgreSQL (40 aprovados, incluindo a exportação), lint e build. **Não executado** (depende de contratação): ACME/DNS reais, provedor real, teste de carga, e-mail e monitores reais. Detalhes em [PRODUCT-CYCLE-02.md](PRODUCT-CYCLE-02.md#lote-3--preparação-para-hospedagem-em-nuvem).

## Ciclo 02, lote 2 — 2026-11-09

Executado de fato: build da imagem Docker, `scripts/compose-validate.sh` do zero (readiness, migração, seed, provisionamento, emissor e redirects OIDC, papéis do banco, queda do banco sem derrubar a API, falha explícita sem configuração e com papel privilegiado), `test:e2e-real` contra o Compose (12 aprovados + 1 após reinício), `npm test` com PostgreSQL (39 aprovados), sem banco (22 aprovados, 1 ignorado), lint, build e Playwright da demo (32 aprovados). O CI ganhou o job `e2e-real`. Detalhes, correções e o que segue não executado em [PRODUCT-CYCLE-02.md](PRODUCT-CYCLE-02.md#lote-2--validação-reproduzível).

## Ciclo 02, lote 1 — 2026-11-09

Executado de fato em container Linux (Node 22.23.4, npm 10.9.9, Docker com PostgreSQL 17 e Keycloak 26.4): `npm ci`, `npm audit` (0 vulnerabilidades), lint, build, migração, `npm test` com PostgreSQL real e papel restrito (36 aprovados), sem banco (21 aprovados, 1 ignorado), Playwright da demonstração (32 aprovados) e fluxo real com Keycloak (11 aprovados + 1 após reinício dos serviços). **Não executados**: build da imagem Docker da aplicação, fluxo real no CI, leitores de tela, Safari/Firefox, zoom real do navegador. Detalhes em [PRODUCT-CYCLE-02.md](PRODUCT-CYCLE-02.md#resultados).

## Ciclo 01 — 2026-11-09

Checks executados de fato em container Linux (Node 22.23.4, npm 10.9.9): `npm ci`, `npm audit` (0 vulnerabilidades), lint, build, `npm test` (14 aprovados, 1 ignorado por falta de PostgreSQL) e Playwright (32 aprovados, desktop e mobile). Comandos, cobertura e limitações em [UX-CYCLE-01.md](UX-CYCLE-01.md#5-verificação-executada-09112026-container-linux-node-22234-npm-1099).

## Registro original — 2026-11-06

## Ambiente desta entrega

Leitura e escrita via conector GitHub. Tentativa de execução local `pwd && ls -la` retornou: **No usable execution environment is available**. Portanto npm, navegador local e PostgreSQL não puderam ser executados nesta sessão até este registro.

## Verificações

| Verificação | Estado |
|---|---|
| Árvore completa do repositório e licença | Recuperadas pelo GitHub |
| Evidências estáticas de autenticação, importação, mensagens e duplicação | Registradas em AUDIT.md |
| Branch separada | Branch de reconstrução, integrada à main pelo PR #7 |
| Build: npm run build | Escrito; resultado ainda não obtido |
| Lint: npm run lint | Escrito; resultado ainda não obtido |
| Testes: npm test | Escritos; resultado ainda não obtido |
| Migração: npm run db:migrate | Escrita; resultado ainda não obtido |
| Testes de RLS, concorrência, replay e rollback | Escritos para PostgreSQL descartável |
| Browser, mobile, teclado, foco, leitor de tela | Não executados |
| Preview | Não disponibilizado nesta sessão |
| Deploy de produção / merge main | Não realizados |

Workflow em .github/workflows/checks.yml (renomeado no ciclo 01) propõe os checks em runner GitHub hospedado. Uma execução só pode ser considerada aprovada após consulta do resultado. Integração PostgreSQL é pulada localmente sem TEST_ADMIN_DATABASE_URL.

## Aceite manual a executar

1. Abrir site em 1440, 1024, 390 e 360 px; verificar overflow, foco e legibilidade.
2. Entrar na demo, alternar as três empresas; confirmar nomes, tema, catálogo e saldos.
3. Buscar por código e nome; testar filtro sem resultados.
4. Criar produto com SKU novo e tentar repetido; registrar entrada e saída acima do saldo.
5. Personalizar cada empresa, salvar, recarregar; testar storage indisponível.
6. Logo válido, inválido, grande e removido; modo escuro nas três paletas.
7. Criar empresa vazia; testar estado vazio e bloqueio de movimento sem produto.
8. Confirmar que compras/cotações/equipe não afirmam concluir operação.
9. Validar OIDC real, issuer/audience errados, expiração, papel e tenant.
10. Só então avançar para integração comercial e PWA.

A/B têm implementação escrita, mas seus critérios completos não foram demonstrados. C é fundação parcial. D/E não executadas.
