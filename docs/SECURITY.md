# Segurança e operação

Esta versão não está liberada para produção nem certificada conforme LGPD.

- Segredos somente no ambiente do servidor. Nunca variáveis VITE_ para chaves, banco ou tokens. .env é ignorado.
- OIDC externo: issuer, audience e JWKS HTTPS obrigatórios; RS256/ES256 permitidos; token com sub, iss, aud, exp e iat; idade máxima 15 minutos. Provisionar provedor confiável e validar discovery antes de configurar. Não escolher JWKS recebido pelo cliente.
- Não há sessão em cookie nem login na UI. Integração futura: Authorization Code + PKCE/BFF, cookie HttpOnly/Secure/SameSite, CSRF e verificação de Origin quando autenticação usar cookies. Nunca persistir tokens em localStorage.
- Revogação central de token não é instantânea via JWKS; limite de idade reduz janela. Membership é consultada por operação. Fluxo de logout/recuperação/MFA ainda depende da integração de identidade.
- Fastify usa helmet, rate limiting por IP sem trustProxy e corpo limitado. Reverse proxy exige configuração de proxy confiável; múltiplas réplicas exigirão limiter compartilhado.
- React renderiza texto; não se aceita CSS/HTML arbitrário no tema. Paletas de tokens não concedem permissões. SVG de usuário não é aceito.
- Banco usa SQL parametrizado e transações com escopo tenant. Aplicar grants mínimos descritos na migration. Nunca usar conta administrativa na API.
- Logs não incluem Authorization/cookie. Auditoria de alterações no banco ainda não é armazenamento imutável externo. Mensagens internas de erro ficam no servidor; acesso aos logs deve ser restrito.
- Não tratar demo como ambiente para dados pessoais, senhas ou documentos reais. Não prometer exclusão, retenção ou conformidade ainda não implementadas.

## Instalação local futura

TLS no proxy e no provedor de identidade, DNS interno, cadeia confiável nos dispositivos, processo de emissão/renovação e alerta de expiração. HTTPS é necessário em contextos seguros de navegador fora de localhost. Recursos do build local não dependem de CDN; autenticação externa pode depender da internet até prover IdP local.

Antes de produção: imagem Docker fixada por digest, banco com volume protegido, segredos externos, migrações controladas, health/readiness separados, backup criptografado, retenção documentada e ensaio de restauração em ambiente isolado. Definir RPO/RTO com o operador. Atualizar com backup, staging, compatibilidade de schema e rollback ensaiado. Não há scripts prontos de backup, recuperação, TLS ou Docker nesta fase.

## LGPD e revisão

Mapear controlador/operador, finalidade, base legal, retenção, direitos do titular, resposta a incidentes, acesso de suporte e subprocessadores antes de captar dados pessoais. Realizar revisão técnica e jurídica adequada. Isto é backlog de implementação, não declaração de conformidade.

Reportar problemas ao mantenedor pelos canais do perfil GitHub, sem publicar credenciais ou dados pessoais em issues.

## Evidência de testes desta entrega

Isolamento RLS, autorização, idempotência concorrente e rollback passaram em PostgreSQL efêmero no CI. Ver docs/VALIDATION.md. Isso não substitui testes com o provedor OIDC real, revisão de infraestrutura ou pentest. Headers da prévia estática são definidos em vercel.json; a API mantém seus próprios headers via helmet.
