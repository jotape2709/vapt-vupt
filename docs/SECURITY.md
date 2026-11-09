# Segurança e operação

Esta versão não está liberada para produção nem certificada conforme LGPD.

- Segredos somente no ambiente do servidor. Nunca variáveis VITE_ para chaves, banco ou tokens. .env é ignorado.
- OIDC externo com BFF ([AUTH.md](AUTH.md)): Authorization Code + PKCE S256, `state` e `nonce` por `openid-client`; ID Token validado no servidor. Emissor HTTPS obrigatório, exceto `localhost` com `OIDC_ALLOW_HTTP=true`. Sem as variáveis de identidade a API não inicia; não existe modo de autenticação falsa.
- Sessão de servidor: cookie opaco HttpOnly, SameSite=Lax, `Secure`/`__Host-` em HTTPS; hash SHA-256 no banco; 30 min de inatividade e 12 h absolutas; rotação no login; revogação no logout e por comando administrativo. Tokens nunca vão para localStorage.
- CSRF: token sincronizador em toda escrita, mais verificação de `Origin`/`Sec-Fetch-Site`.
- Autorização: membership e função conferidas no banco a cada operação ([AUTHORIZATION.md](AUTHORIZATION.md)); RLS com FORCE; a API recusa iniciar com papel privilegiado.
- Logotipo: só PNG/JPEG/WebP (sem SVG), até 256 KB e 16–1024 px, estrutura conferida no servidor; servido com `X-Content-Type-Options: nosniff` e CSP `sandbox`, apenas a membros.
- Limitações: sem back-channel logout do provedor; sem MFA exigido pelo realm local; rate limit em memória de um processo.
- Fastify usa helmet, rate limiting por IP sem trustProxy e corpo limitado. Reverse proxy exige configuração de proxy confiável; múltiplas réplicas exigirão limiter compartilhado.
- React renderiza texto; não se aceita CSS/HTML arbitrário no tema. Paletas de tokens não concedem permissões. SVG de usuário não é aceito.
- Banco usa SQL parametrizado e transações com escopo tenant. Aplicar grants mínimos descritos na migration. Nunca usar conta administrativa na API.
- Logs não incluem Authorization/cookie. Auditoria de alterações no banco ainda não é armazenamento imutável externo. Mensagens internas de erro ficam no servidor; acesso aos logs deve ser restrito.
- Não tratar demo como ambiente para dados pessoais, senhas ou documentos reais. Não prometer exclusão, retenção ou conformidade ainda não implementadas.

## Instalação local futura

TLS no proxy e no provedor de identidade, DNS interno, cadeia confiável nos dispositivos, processo de emissão/renovação e alerta de expiração. HTTPS é necessário em contextos seguros de navegador fora de localhost. Recursos do build local não dependem de CDN; autenticação externa pode depender da internet até prover IdP local.

Antes de produção: imagem Docker fixada por digest, banco com volume protegido, segredos externos, migrações controladas, health/readiness separados, backup criptografado, retenção documentada e ensaio de restauração em ambiente isolado. Definir RPO/RTO com o operador. Atualizar com backup, staging, compatibilidade de schema e rollback ensaiado. Não há scripts prontos de backup, recuperação ou TLS. O `compose.yaml` do ciclo 02 é só de desenvolvimento: HTTP, senhas de exemplo, Keycloak `start-dev` e imagem sem digest.

## LGPD e revisão

Mapear controlador/operador, finalidade, base legal, retenção, direitos do titular, resposta a incidentes, acesso de suporte e subprocessadores antes de captar dados pessoais. Realizar revisão técnica e jurídica adequada. Isto é backlog de implementação, não declaração de conformidade.

Reportar problemas ao mantenedor pelos canais do perfil GitHub, sem publicar credenciais ou dados pessoais em issues.
