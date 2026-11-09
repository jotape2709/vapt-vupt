# Arquitetura e decisões

## ADR 001 — Monorepositório pequeno

React + TypeScript + Vite para site público e aplicativo inicial. Separar Next.js agora acrescentaria infraestrutura sem requisito de SSR demonstrado. apps/web contém interface, apps/api contém Fastify, packages/domain contém contratos Zod, db/migrations contém schema versionado. Separar domínio de apresentação permite extração futura.

A origem acadêmica fica em legacy/, fora do build. A licença MIT permanece.

## ADR 002 — Demo e operação são ambientes distintos (revisado no ciclo 02)

Mesma interface (`Workspace`), duas fontes de dados atrás da interface `Gateway`:

- `/demo` usa `DemoGateway`: empresas fictícias, saldos e histórico em `localStorage` do navegador (o histórico persiste entre recarregamentos, limitado a 200 registros por empresa; o texto antigo deste ADR, que dizia “dura uma sessão”, estava errado desde o ciclo 01). Nunca conversa com a API, não é backup nem auditoria, e nada dela é importado para empresas reais.
- `/app` usa `ApiGateway`: tudo vem da API; nenhum dado operacional fica em `localStorage`. Cada troca de empresa cria um gateway novo, cancela as requisições do anterior (AbortController) e descarta respostas que declaram outra organização.

A interface marca o ambiente (“DEMONSTRAÇÃO” × “OPERAÇÃO REAL”) e só anuncia “confirmado pelo servidor” quando a API respondeu.

## ADR 003 — Tenant e permissões (revisado no ciclo 02)

Cada operação usa uma transação com `app.org_id`, `app.issuer` e `app.subject` locais. A membership é conferida no banco antes de qualquer leitura ou escrita (`Database.asMember`); nomes, temas e módulos não concedem autorização. Matriz em [AUTHORIZATION.md](AUTHORIZATION.md).

RLS com `FORCE`; runtime `vv_runtime` (grupo `vv_app`) sem superusuário, `BYPASSRLS` ou ownership, verificado na inicialização. Chaves compostas impedem relações entre empresas. Provisionamento de empresas e funções é administrativo (`npm run admin`), transacional e auditado.

Catálogo por organização; saldo por unidade em `stock_levels`. O piloto permite uma unidade principal por empresa (índice único parcial) e a interface mostra qual é. Configuração da empresa em `organization_settings`, versionada e append-only; paletas e blocos vêm de listas fechadas, sem CSS ou scripts. Logotipo em `organization_assets` (PNG/JPEG/WebP, até 256 KB, 16–1024 px, assinatura e estrutura conferidas no servidor), servido só a membros da empresa.

## ADR 004 — Movimentações

Quantidade inteira nesta base (inclusive kg/L); fracionamento exige migração para decimal exato antes de uso nesses segmentos. Cadastro exige saldo inicial zero. Evento: UUID, produto, tipo, quantidade, motivo e expectedVersion. Transação: autorização → lock de evento → busca idempotente → lock do produto → comparação da versão → alteração do saldo → evento e auditoria → commit.

Mesmo evento e conteúdo: retorna resultado persistido, sem duplicação. Mesmo UUID e conteúdo diferente: 409. Versão desatualizada: 409, sem ajuste automático. Falha de saldo: rollback. O frontend demo usa validação local, não simula esse protocolo como se estivesse conectado.

Ciclo 02: o saldo saiu de `products.quantity` (congelado por gatilho, mantido só por compatibilidade) para `stock_levels` por unidade. Servidor define horário, autor (`actor_name`), saldo antes/depois e nova versão. O cliente gera o `eventId` uma vez por formulário e o reutiliza em qualquer reenvio; idempotência por advisory lock `(org, eventId)`. Em timeout ou queda de conexão o resultado é **desconhecido**: a interface trava os campos e oferece “Verificar registro”, que consulta `GET /movements/:eventId` (404 = não registrado, pode reenviar com o mesmo id). Conflito de versão (409 `version_conflict`) e saldo insuficiente (409 `insufficient_balance`) devolvem o saldo atual; a interface atualiza a prévia, gera novo id e pede revisão.

## ADR 005 — Offline e intranet (fase D bloqueada)

Nenhum Service Worker, cache offline, manifesto instalável ou fila IndexedDB é anunciado nesta entrega. Instalar cache antes de resolver autenticação, expiração, logout, política de dados locais e conflitos pode expor dados.

Desenho previsto: shell versionado servido pelo servidor local; IndexedDB particionada por organização/usuário/dispositivo; fila com UUID, versão esperada, estados draft/pending/confirmed/conflict/rejected; só resposta persistida da API confirma evento; logout remove dados sensíveis; políticas de operação offline por função; confirmação humana de conflitos. Desconexão da internet não significa desconexão da intranet. navigator.onLine não prova sincronização.

Pré-requisitos restantes (integração OIDC/UI e persistência foram entregues no ciclo 02): gestão de membros na interface, tratamento de perda de dispositivo e evidência de testes de desconexão/reconexão. O ciclo 02 trouxe um `compose.yaml` **de desenvolvimento** (PostgreSQL + Keycloak); instalação local de produção continua na fase D. Não confundir esse Compose ou `npm run dev` com implantação pronta.

## ADR 006 — BFF com sessão de servidor (ciclo 02)

O navegador não recebe tokens. A API faz Authorization Code + PKCE com `openid-client`, valida o ID Token e cria uma sessão no PostgreSQL; o cookie é opaco e HttpOnly. Escolhido em vez de SPA com tokens porque elimina tokens em JavaScript, permite revogação imediata e mantém tudo no mesmo domínio. Custo: estado de sessão no banco e CSRF obrigatório (token sincronizador + verificação de origem). Detalhes em [AUTH.md](AUTH.md). O `jose`/Bearer do ciclo anterior foi removido junto com o repositório antigo.

## ADR 007 — Listas no servidor (ciclo 02)

Estoque e histórico são paginados por cursor (keyset): `lower(name), id` e `created_at, id`, com cursores opacos. A busca usa `vv_normalize` (sem acentos, sem extensão do PostgreSQL) numa coluna gerada e `LIKE` com escape. Contagens (todos, repor, suficiente, catálogo) vêm do servidor, então a interface não trunca em 1.000 produtos nem em 200 registros. Testado com mais de 1.005 produtos e 205 movimentações.

## Evolução do domínio

GTIN/EAN com dígito verificador, embalagens/fator de conversão, lotes, validade, unidades logísticas, depósitos/localizações, transferências com duas pernas na mesma transação e inventário com aprovação serão agregados independentes com tenant em todas as chaves. Compras, fornecedores, propostas e POS terão contratos e adaptadores externos; nenhuma integração fictícia é produzida. Reposição atual é apenas comparação com mínimo; previsão depende de histórico real e avaliação.
