# Arquitetura e decisões

## ADR 001 — Monorepositório pequeno

React + TypeScript + Vite para site público e aplicativo inicial. Separar Next.js agora acrescentaria infraestrutura sem requisito de SSR demonstrado. apps/web contém interface, apps/api contém Fastify, packages/domain contém contratos Zod, db/migrations contém schema versionado. Separar domínio de apresentação permite extração futura.

A origem acadêmica fica em legacy/, fora do build. A licença MIT permanece.

## ADR 002 — Demo e operação são ambientes distintos

O frontend atual usa dados fictícios, preferências e saldos locais em localStorage, jamais autenticação. Persistência é apenas por navegador, pode falhar e não é backup. Histórico de movimentos dura uma sessão; ao recarregar, começa vazio. Sem transmissão, sincronização ou confirmação de servidor.

A área /app conecta OIDC, diretório de empresas, catálogo e movimentações à API. A demo permanece isolada. A fundação C ainda depende de homologação com provedor real, provisionamento e gestão de membros. Toda chamada operacional exige token OIDC validado por jose, issuer/audience/assinatura/expiração/idade máxima e membership no PostgreSQL. Não existe token demo aceito no servidor real. A injeção de verificador em testes ocorre só no construtor interno, não por header ou variável de bypass.

## ADR 003 — Tenant e permissões

Cada consulta operacional usa transação e app.org_id com escopo LOCAL. Membership é obtida por organização, subject e issuer. Nomes ou temas não concedem autorização. Papel: viewer lê; operator lê/movimenta; manager/owner configuram e cadastram. Admin central ainda não implementado.

RLS habilitada e FORCE RLS; papel de runtime separado, sem SUPERUSER/BYPASSRLS e sem ownership. Chaves compostas impedem relações produto/evento cruzando organizações. Runtime não deve alterar memberships nem apagar logs. Provisionamento inicial de organização e membro ainda é tarefa administrativa, fora da API.

Unidades têm tabela inicial, mas estoque nesta versão está agregado por organização. Não anunciar estoque por depósito/unidade. Tema é objeto versionado com allowlist; paletas são controladas, não CSS livre. Upload demo limitado a PNG/JPEG/WebP decodificáveis; armazenamento remoto de logo ainda não existe. API recebe logo como dado do tema, sem pipeline de arquivo comercial.

## ADR 004 — Movimentações

Quantidade inteira nesta base (inclusive kg/L); fracionamento exige migração para decimal exato antes de uso nesses segmentos. Cadastro exige saldo inicial zero. Evento: UUID, produto, tipo, quantidade, motivo e expectedVersion. Transação: autorização → lock de evento → busca idempotente → lock do produto → comparação da versão → alteração do saldo → evento e auditoria → commit.

Mesmo evento e conteúdo: retorna resultado persistido, sem duplicação. Mesmo UUID e conteúdo diferente: 409. Versão desatualizada: 409, sem ajuste automático. Falha de saldo: rollback. O frontend demo usa validação local, não simula esse protocolo como se estivesse conectado.

## ADR 005 — Offline e intranet (fase D bloqueada)

Nenhum Service Worker, cache offline, manifesto instalável ou fila IndexedDB é anunciado nesta entrega. Instalar cache antes de resolver autenticação, expiração, logout, política de dados locais e conflitos pode expor dados.

Desenho previsto: shell versionado servido pelo servidor local; IndexedDB particionada por organização/usuário/dispositivo; fila com UUID, versão esperada, estados draft/pending/confirmed/conflict/rejected; só resposta persistida da API confirma evento; logout remove dados sensíveis; políticas de operação offline por função; confirmação humana de conflitos. Desconexão da internet não significa desconexão da intranet. navigator.onLine não prova sincronização.

Pré-requisitos: integração OIDC/UI, persistência testada, permissões completas, tratamento de perda de dispositivo e evidência de testes de desconexão/reconexão. Docker Compose e instalação local de produção ficam para D; não confundir npm run dev com implantação pronta.

## Evolução do domínio

GTIN/EAN com dígito verificador, embalagens/fator de conversão, lotes, validade, unidades logísticas, depósitos/localizações, transferências com duas pernas na mesma transação e inventário com aprovação serão agregados independentes com tenant em todas as chaves. Compras, fornecedores, propostas e POS terão contratos e adaptadores externos; nenhuma integração fictícia é produzida. Reposição atual é apenas comparação com mínimo; previsão depende de histórico real e avaliação.

## ADR 006 — Acesso conectado e recibo de envio

Cliente OIDC mantido (oidc-client-ts), Authorization Code + PKCE S256. Tokens apenas em memória; sessionStorage guarda estado transitório do protocolo e recibos de envios por issuer/subject. Recarregar exige autenticar novamente. Não há refresh token, renovação silenciosa, token demo ou login caseiro. Encerrar sessão no app não encerra a sessão do IdP.

/api/me/organizations usa transação com app.subject/app.issuer obtidos exclusivamente do token validado. Políticas RLS SELECT permitem consultar somente memberships da própria identidade e suas organizações. Consultas de produtos e movimentos continuam exigindo tenant + membership. Não há SECURITY DEFINER nem bypass RLS na API.

O recibo em sessionStorage contém org, UUID e payload do evento, é salvo antes do envio e não autentica ninguém. Falha em salvar bloqueia o envio. Perda de resposta mantém o mesmo evento; retentativa explícita usa o UUID original. Sessão expirada preserva recibo para verificar após novo login na mesma aba. A API revalida autorização. Não é fila offline: fechar a aba apaga o recibo; não permite criar operações desconectadas, nem substitui auditoria e recuperação no servidor. A fase D continua pendente.

Contrato de tema v2 usa blue/navy/sky. Preferências v1 da demo são migradas sem apagar catálogo. Migration 002 converte configurações do banco e adiciona diretório de identidade e índice. Não altera a migration 001 já aplicada.
