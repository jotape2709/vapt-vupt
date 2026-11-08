# Próximas entregas — backlog acionável

Cada tarefa deve terminar com código revisável, testes e documentação atualizada. A ordem pode mudar por pedido do responsável; a conclusão de uma tarefa não implica conclusão de toda a fase.

## 1. Homologar identidade e instalação da fase C

Fontes: `apps/web/auth.ts`, `apps/api/identity.ts`, `apps/api/server.ts`, `docs/CONNECTED_ACCESS.md`, migrations, `tests/identity.test.ts`, `tests/database.test.ts` e `tests/connected/access.spec.ts`.

Definir/provisionar o IdP da instalação com o responsável, cliente público/PKCE, issuer/audience/JWKS, callback/origens exatos, proxy da API e CSP para a origem selecionada. Criar procedimento reproduzível de organização/membership, sem segredos versionados. Homologar logout local versus IdP, expiração, revogação, troca de usuário e perda de resposta. Não reutilizar a conta de migração como runtime.

Aceite: fluxo real descrito e ensaiado; nenhum tenant indevido; erros e sessões verificados. Fixture OIDC continua teste, não IdP de produção.

## 2. Provisionamento seguro e gestão de organizações/equipe

Fontes: `apps/api/repository.ts`, `apps/api/app.ts`, `packages/domain/index.ts`, `db/migrations/`, `apps/web/ConnectedApp.tsx`.

Criar contratos de onboarding comercial, organizações/unidades, convites e papéis; fechar a política de quem pode criar/convidar/alterar membros. Não basta mostrar/esconder menu. Evoluir RLS e grants com migrations novas. Testar usuário sem vínculo, viewer, operador, gestor, organização trocada, convite repetido e revogação.

Aceite: persistência real, auditoria e testes de isolamento das novas operações; nenhuma mutação de papel aceita a partir de tema ou de dados não validados.

## 3. Personalização conectada, paginação e UX

Fontes: `apps/web/App.tsx` (demo/editor), `ConnectedApp.tsx`, `api-client.ts`, `packages/domain/index.ts`, `docs/BRAND.md`, `public/brand/`.

Separar/reutilizar componentes sem acoplar estado demo ao servidor. Conectar edição de tema com autorização e conflitos; projetar armazenamento seguro de logos. Paginar catálogo/histórico sem truncamento silencioso. Homologar celular, teclado, leitor de tela e tarefas reais de balcão. Preservar a identidade azul e feedback acionável.

## 4. Preparar e implementar fase D

Fontes: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `apps/web/pending-operation.ts` e núcleo de movimentos.

Somente após as decisões e validações de C: definir política offline por operação/função, partição de dados por identidade/tenant/dispositivo, IndexedDB, estados de fila e conflitos. Projetar expiração/logout/perda de dispositivo antes de cachear dados. Servidor local/intranet deve ter TLS/certificados, backup/restauração e atualização ensaiados. Não converter o recibo de sessionStorage em alegação de operação offline.

## 5. Evolução operacional da fase E

Tratar separadamente GTIN, embalagens/conversão, frações, unidades/depósitos, lotes, validades, inventários, compras/cotações reais e POS. Exigir dados reais e avaliação antes de alegar inteligência preditiva. Não construir todos os módulos avançados simultaneamente.
