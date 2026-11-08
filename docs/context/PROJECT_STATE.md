# Estado do Vapt-Vupt Next

Data da revisão humana/assistida: 08/11/2026. Base funcional desta passagem: `031f84f1715d9cc9e1447b41cdea85c60e1fb235`. O hash identifica a passagem, não congela o projeto; confira o código e `context:check` depois de novas alterações.

## Missão e público

Transformar o projeto acadêmico em gestão comercial modular para pequenos estabelecimentos. UX é prioridade: linguagem de balcão, estoque legível, busca rápida, erros acionáveis, nenhuma confirmação inventada. A identidade é azul, com monograma VV; três empresas fictícias demonstram personalização, sem representar clientes.

## O que funciona na demonstração

- Site público; Mercado Aurora, Adega Vértice e Bar da Esquina com catálogos separados.
- Nome, logo local, três paletas azuis, modo claro/escuro, fonte, densidade e módulos no menu.
- Busca, filtros, cadastro e entradas/saídas demonstrativos. Preferências/saldos no navegador; histórico demo só na sessão.
- Onboarding cria empresa fictícia local. Não cria organização comercial no servidor.
- Migração das preferências de tema v1 para v2 preserva catálogo. Configuração visual não concede acesso.

## O que está implementado na área conectada

- `/app` e `/auth/callback`, oidc-client-ts, Authorization Code + PKCE S256; tokens só em memória.
- API Fastify, contratos Zod e PostgreSQL com migrations 001 e 002.
- Diretório de empresas baseado na identidade validada, membership e RLS; sem SECURITY DEFINER no diretório.
- Produtos, cadastro por gestor, movimentos por operador/gestor e últimos 100 eventos persistidos.
- UUID, expectedVersion, transação, saldo não negativo, replay idempotente, 409 explícito e auditoria.
- Recibo de envio em sessionStorage por issuer/subject; erro de rede preserva payload/UUID para verificar. Novo login na mesma aba pode recuperá-lo. Fechar a aba perde o recibo.
- Replay antigo não reduz a versão/saldo mais recente já carregado na interface.

## O que ainda não está liberado ou implementado

- Nenhum IdP real ou banco de produção foi provisionado/homologado nesta passagem. Preview Vercel está sem OIDC e protegido por login Vercel.
- Cadastro comercial de organizações/unidades, convites, gestão completa de equipe e administração central.
- Editor conectado completo de tema e pipeline comercial de armazenamento de logos. A API possui contrato de tema; a demo tem editor local.
- Paginação comercial: catálogo conectado até 1.000 produtos e histórico até 100 movimentos.
- Quantidades fracionárias, estoque por unidade/depósito, GTIN validado, embalagens, lotes, validades, transferências e inventários.
- Compras, cotações, fornecedores e POS reais; inteligência de reposição preditiva. Hoje a prioridade é saldo abaixo do mínimo.
- PWA instalável, cache, IndexedDB, política de operação offline, Docker Compose pronto, TLS, backup/restauração e atualizações de instalações.
- Homologação com usuários do comércio e auditoria de acessibilidade completa.

## Evidência de validação da base

Execução [42515479160](https://github.com/jotape2709/vapt-vupt/actions/runs/42515479160), commit `031f84f`:

- npm ci, audit, lint, build e migrations concluídos; audit sem vulnerabilidades reportadas naquela execução.
- 10 testes de domínio/API/banco aprovados, incluindo PostgreSQL real, sem ignorados.
- 8 testes da demo e 4 conectados aprovados em desktop/celular. Nos quatro conectados, OIDC e API são simulados, sem bypass no app; criptografia JWT e banco têm testes próprios.
- Cobre perda de resposta, novo login, replay e versão mais recente de outro operador.

Isso é evidência histórica específica; não certifica produção nem as próximas alterações. `docs/VALIDATION.md` guarda outros resultados e seus limites. ESLint 9 emitiu aviso de fim de suporte; a atualização do tooling segue pendente, apesar do audit limpo da base.

## Fases

| Fase | Situação desta passagem |
|---|---|
| A — auditoria/fundação | Código, licença, legado e documentação revisados; testes disponíveis |
| B — identidade/UX | Identidade azul e demo implementadas; homologação de público e acessibilidade pendentes |
| C — núcleo operacional | Área conectada e API implementadas parcialmente; IdP real e gestão de organizações/equipe pendentes |
| D — PWA/intranet/offline | Pendente; não pular as validações de C |
| E — evolução comercial | Pendente |

## Próxima ação recomendada

Siga `NEXT_TASKS.md`. Antes de avançar para D, deixe uma instalação de homologação reproduzível com IdP real, papéis corretos e testes de revogação, sessão e recuperação. Se a tarefa pedida for visual, preserve o azul e não confunda a demo com operação real. Decisões de provedor/infraestrutura ainda não estão fechadas por este documento.

## Contexto para continuidade entre ferramentas

Esta passagem acrescenta AGENTS.md, CLAUDE.md, regra Antigravity e comandos context:* para recuperar evidências atuais. TOPICS.json associa assuntos a módulos; o mapa e o snapshot são gerados. A recuperação é lexical/estrutural local, sem embeddings ou treinamento STAIR. Ela não altera o estado de liberação comercial descrito acima.
