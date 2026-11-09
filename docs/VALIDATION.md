# Registro de validação — 2026-11-06

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
