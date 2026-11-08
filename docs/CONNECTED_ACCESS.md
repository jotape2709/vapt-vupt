# Acesso conectado — configuração e limites

A prévia continua demonstrativa sem configuração. /app informa isso sem pedir senha. Não há credencial de teste embutida. /auth/callback é reservado ao provedor.

## Configurar uma instalação de desenvolvimento

1. Provisione PostgreSQL; execute migrations 001 e 002 com a conta de migração dedicada. A 002 exige BYPASSRLS para transformar todos os temas. A conta da API deve ser restrita conforme os grants da 001; ela é verificada no startup.
2. Cadastre organização e membership administrativamente (subject e issuer exatos do provedor). Convites/onboarding comercial não estão implementados. Tema deve respeitar ThemeSchema v2. Não conceda à API escrita em memberships.
3. Crie um cliente **público** no provedor OIDC, sem client secret no frontend, com Authorization Code e PKCE S256. Registre somente os callbacks e origens exatos. Configure o audience esperado pela API nos access tokens. Não use ID token para chamar a API.
4. Configure OIDC_ISSUER, OIDC_AUDIENCE, OIDC_JWKS_URL e DATABASE_URL no servidor. Configure VITE_OIDC_AUTHORITY e VITE_OIDC_CLIENT_ID no build web. Esses dois valores são públicos; nenhuma chave privada deve ter prefixo VITE_.
5. No desenvolvimento, Vite encaminha /api para 127.0.0.1:3001. Em instalação, sirva web e API na mesma origem por proxy TLS. A API não aceita cookie como credencial; o cliente usa Authorization Bearer e credentials:omit.
6. O CSP de vercel.json é fechado por padrão (connect-src self). Ao homologar OIDC, acrescente **apenas a origem HTTPS do seu provedor** ao connect-src do proxy/hosting para discovery e token endpoint. Não substitua por curinga. Cadastre /auth/callback no provedor e preserve os rewrites /app e /auth/callback.
7. Exporte as variáveis de servidor antes de npm run dev:api e db:migrate. O .env do Vite é carregado apenas pelo frontend; a API não o carrega automaticamente.

## Fluxos implementados

- Entrada por OIDC e lista de empresas autorizadas pelo banco.
- Leitura de produtos e últimos 100 eventos de estoque persistidos.
- Cadastro de produto por gestor/proprietário; saldo inicial zero.
- Entrada/saída por operador ou gestor, com UUID e versão esperada.
- 409 exige recarregar/conferir; nenhum saldo é ajustado silenciosamente.
- Recibo por issuer/subject em sessionStorage antes do envio. Sem confirmação, o botão Verificar confirmação reenvia o mesmo UUID/payload. O servidor decide replay ou conflito. Se a sessão expirar, o recibo fica na aba para verificação após novo login.
- Tokens só em memória; refresh exige novo login. Sem renovação silenciosa. Encerrar sessão no aplicativo não encerra a sessão do provedor.

## Limites desta entrega

Nenhum provedor ou banco de produção foi provisionado. OIDC real ainda não foi homologado. Testes criptográficos validam o verificador e testes de banco exercitam isolamento, mas não equivalem a um ensaio completo da instalação. Logo, edição visual conectada, cadastro de organizações/unidades, convites, controle de sessões central e recuperação de operações entre dispositivos continuam pendentes. O catálogo conectado limita-se a 1.000 produtos, movimentos a 100 registros; paginação comercial ainda será feita.

Recibo local não é fila offline nem backup. Fechar a aba elimina o recibo; limpar dados do navegador também. Antes de uso comercial, implementar política de recuperação no servidor/por dispositivo e ensaiar perda de resposta, revogação de membership, logout, perda de dispositivo e conflitos. PWA, IndexedDB e operação offline seguem na fase D.

## Testar o fluxo sem credenciais reais

`npm run test:connected` usa um servidor Vite de teste e intercepta discovery, autorização, token e API com fixtures. A bateria demonstra PKCE, confirmação explícita e perfil de consulta; a segurança criptográfica da API e o isolamento PostgreSQL são testados separadamente. Esses testes não substituem a homologação do provedor real.
