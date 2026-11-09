# Vapt-Vupt em nuvem: instalação, operação e continuidade

> **Situação:** os arquivos em `deploy/cloud/` foram **ensaiados em ambiente isolado** (seção [Resultados](#resultados-do-ensaio-isolado)). **Não há instalação de produção.** Nenhum domínio, VPS, armazenamento ou monitor foi contratado.
>
> Contexto e decisão: [ADR 0001](../adr/0001-hospedagem-em-nuvem.md). Custos: [CUSTOS.md](CUSTOS.md). Responsabilidades: [RESPONSABILIDADES.md](RESPONSABILIDADES.md). O ambiente de desenvolvimento continua em [LOCAL-DEV.md](../LOCAL-DEV.md) e não muda.

## Arquitetura padrão (uma VPS)

```text
 navegador ──HTTPS──▶ Caddy :443 (TLS automático, HSTS pela aplicação)
                        │  app.<domínio>   ──▶ app:3001   (API + interface; papel vv_runtime)
                        │  login.<domínio> ──▶ keycloak:8080 (/admin, /metrics, /health → 404)
                        ▼
                 rede interna do Compose (sem portas publicadas)
                        ├─ postgres:5432  bancos vapt_vupt (RLS) e keycloak (dono próprio)
                        └─ app ──http interno──▶ keycloak (OIDC_INTERNAL_ORIGIN)
 operador ──SSH──▶ VPS ── túnel 127.0.0.1:8081 ──▶ console do Keycloak
 backup diário: pg_dump | age (chave pública) ──rclone──▶ armazenamento S3 de OUTRO provedor
```

| Requisito | Como está atendido | Verificado no ensaio |
|---|---|---|
| HTTPS | Caddy com ACME (Let's Encrypt). No ensaio, CA de teste | sim (TLS da CA de teste, HSTS e cookie `__Host-`) |
| Banco sem exposição pública | `postgres` sem `ports` | sim |
| Autenticação e redirects | Realm importado com `redirectUris` exatos (`${VV_APP_ORIGIN}/auth/callback`), PKCE S256, sem cadastro público | sim (login real no navegador) |
| Papéis restritos | `vv_runtime` sem superusuário, `BYPASSRLS` ou ownership. A API recusa iniciar se o papel puder ignorar a RLS | sim |
| Isolamento entre empresas | RLS com `FORCE` mais membership no servidor (sem mudança) | testes de integração e e2e; restauração confere RLS |
| Configuração e logo por empresa | No banco, versionados por organização (backup e exportação incluem) | sim (contagens restauradas) |
| Segredos fora do repositório | `.env` e `backup.env` no servidor (chmod 600, ignorados pelo Git e pelo build). Os modelos não têm valores utilizáveis | sim (preflight e init recusam modelos e senhas `dev-only`) |
| Teste separado do comercial | Projeto Compose, domínios e segredos próprios. Restauração recusa volume existente e nome de produção | sim |

**Ponto único de falha:** VPS, disco, região do provedor, Keycloak e PostgreSQL. **Não é alta disponibilidade.**

## Arquivos

| Arquivo | Função |
|---|---|
| `deploy/cloud/Dockerfile` | Imagem de produção: JS compilado (`npm run build:server`), sem tsx nem dependências de desenvolvimento, usuário `node` |
| `deploy/cloud/compose.yaml` | Caddy, PostgreSQL, Keycloak (`start`, banco próprio), aplicação. `migrate` e `admin` no perfil `ops`. Política `restart: unless-stopped`, healthchecks e logs `json-file` com 10 MB × 5 por serviço |
| `deploy/cloud/caddy/` | `Caddyfile` (ACME) e `sites.caddy` (rotas). Sem log de acesso: a API registra as requisições sem a query de `/auth/*` |
| `deploy/cloud/postgres/init/01-roles.sh` | Papéis `vv_migrator`, `vv_app`, `vv_runtime` e `keycloak`. Recusa senhas curtas ou de exemplo |
| `deploy/cloud/keycloak/realm-vapt.json` | Realm sem usuários e sem segredo (placeholders `${VV_…}`), política de senha, proteção contra força bruta, pt-BR |
| `deploy/cloud/.env.example`, `backup.env.example` | Modelos **sem** valores utilizáveis |
| `deploy/cloud/ops/` | `preflight.sh`, `install.sh`, `backup.sh`, `restore.sh`, `update.sh` e units `systemd` do backup |
| `deploy/cloud/test/` | Ensaio isolado (`drill.sh`), CA de teste e verificação no navegador. **Não usar em servidor comercial** |

## Instalação no provedor (quando aprovada)

Depende do que **não está contratado**: VPS, domínio, armazenamento externo, monitor e e-mail.

1. **Conta e VPS.**
   - Ativar MFA na conta do provedor e criar um alerta de cobrança.
   - Criar a VPS Ubuntu LTS do plano aprovado.
   - Firewall do provedor: entrada só em 22 (SSH, de preferência restrita ao IP do operador), 80 e 443.
2. **Endurecimento.**
   - Criar o usuário `vapt` com chave SSH e desativar senha e login de root no SSH.
   - Ativar `unattended-upgrades`.
   - Instalar Docker Engine com Compose v2, `age` e `git`. O usuário `vapt` no grupo `docker` equivale a root no servidor: guardar a chave SSH como segredo.
3. **DNS.** Criar registros `A`/`AAAA` para `app.<domínio>` e `login.<domínio>` (TTL de 300 s facilita a recuperação).
4. **Código e imagem.**
   ```bash
   git clone https://github.com/jotape2709/vapt-vupt.git /opt/vapt-vupt && cd /opt/vapt-vupt
   git checkout <tag aprovada>
   docker build -f deploy/cloud/Dockerfile --build-arg VV_VERSION=<tag> -t vapt-vupt-app:<tag> .
   ```
   Sem registro de imagens no piloto: a imagem é construída no servidor a partir de uma tag. O uso de um registro privado é decisão futura.
5. **Segredos.**
   ```bash
   cd deploy/cloud && cp .env.example .env && cp backup.env.example backup.env && chmod 600 .env backup.env
   ```
   - Preencher os arquivos, gerando cada segredo com `openssl rand -base64 32`.
   - `VV_BACKUP_AGE_RECIPIENT` é a chave **pública** gerada **fora do servidor** com `age-keygen`. A chave privada vai para o cofre do fornecedor.
   - Guardar uma cópia do `.env` no cofre.
6. **Instalar.** Rodar `ops/install.sh`. Ele executa o preflight, o banco, as migrations e os serviços, e verifica `/ready`, o emissor OIDC e que `/admin` dá 404 no domínio público.
7. **Keycloak.** Abrir um túnel SSH (`ssh -L 8081:127.0.0.1:8081 vapt@servidor`) e acessar `http://127.0.0.1:8081/admin`.
   - Criar um administrador **nominal** com MFA no realm `master` e **desativar** `bootstrap-admin`.
   - Configurar SMTP se aprovado (decisão 9).
8. **Backup e monitores.**
   - Copiar as units de `ops/systemd/`, ajustar os caminhos e rodar `systemctl enable --now vapt-vupt-backup.timer`.
   - Rodar `ops/backup.sh` uma vez manualmente.
   - Criar monitores externos para `https://app.<domínio>/ready` e `https://login.<domínio>/realms/vapt/.well-known/openid-configuration`, além do heartbeat do backup.
9. **Primeiro ensaio no provedor real.** Rodar `ops/restore.sh` numa VPS temporária (seção abaixo) e registrar o tempo. **Só depois disso** as metas de RTO deixam de ser estimativas.
10. **Empresas e pessoas.**
    - Criar o usuário no Keycloak (console ou `kcadm`).
    - Rodar `docker compose --profile ops run --rm admin provision … --owner-issuer https://login.<domínio>/realms/vapt --owner-subject <id>`.
    - Conceder funções com `admin grant`.

## Operação

| Tarefa | Comando | Observações |
|---|---|---|
| Conferir configuração | `ops/preflight.sh` | Não altera nada |
| Estado e logs | `docker compose ps` / `docker compose logs --since 1h app` (no diretório `deploy/cloud`, com `--env-file .env`) | Logs com rotação. Senhas, segredo do cliente e código OIDC não aparecem (verificado no ensaio) |
| Backup manual | `ops/backup.sh` | Dump cifrado com age, envio com rclone `--immutable` e conferência com `rclone check` |
| Atualizar | `ops/update.sh vapt-vupt-app:<nova-tag>` | Preflight, backup, migrations em transação única e troca da aplicação. Se a nova versão não ficar saudável, volta à anterior (testado) |
| Exportar uma empresa | `docker compose --profile ops run --rm -T admin export --org <id> > empresa.json` | Auditado (`org.exported`) |
| Encerrar sessões de alguém | `admin revoke-sessions --issuer … --subject …` | |
| Rotacionar o segredo OIDC | Gerar o segredo novo e aplicá-lo no client `vapt-vupt-web` pelo console. Depois, atualizar `VV_OIDC_CLIENT_SECRET` no `.env` e rodar `docker compose up -d app` | A importação do realm só ocorre na primeira inicialização |

**Migrations:** são aditivas por regra do projeto (nunca editadas, só arquivos novos) e rodam numa transação única: se falharem, nada é aplicado. Uma migration **não aditiva** exige janela planejada, backup imediatamente antes e, se der errado, restauração, com perda do que foi registrado depois do backup.

## Backup e restauração

- **O que entra:**
  - `pg_dump` dos bancos `vapt_vupt` (dados, configurações, logos e auditoria de todas as empresas) e `keycloak` (realm, usuários, hashes de senha e segredo do client);
  - um manifesto com versão do schema, imagem, contagem de linhas por tabela e tabelas com RLS forçada.
- **Como sai:** cada arquivo é cifrado com `age` para a chave pública do fornecedor **antes** de tocar o disco. O ensaio confirma que nenhum texto dos dados aparece nos arquivos.
- **O que não entra, e precisa estar no cofre:**
  - o `.env`, com os segredos do banco e do OIDC;
  - a **chave privada age**;
  - o acesso ao provedor, ao DNS e ao armazenamento externo;
  - a tag da imagem.

  Sem esses itens, os backups não restauram um serviço funcionando.
- **Retenção proposta:** 7 dias no servidor e 35 dias no armazenamento externo, por regra de ciclo de vida do bucket com **bloqueio de objetos/imutabilidade** onde o provedor oferecer. A credencial do servidor **não pode excluir**: um invasor no servidor não consegue apagar os backups externos.
- **Snapshots do provedor** são complementares, para voltar rápido a VPS inteira. Ficam na mesma conta, então não protegem contra perda ou bloqueio da conta.

**Ensaio de restauração** (trimestral proposto, sempre fora da VPS de produção):

```bash
rclone copy offsite:<bucket>/vapt-vupt/<carimbo> ./restore-in        # baixa um backup
deploy/cloud/ops/restore.sh --backup ./restore-in --identity ~/cofre/age-identity.txt
```

O script confere o SHA256 e decifra. Em seguida:

1. Sobe um PostgreSQL **novo**, num projeto separado e com segredos descartáveis.
2. Restaura os dois bancos e roda as migrations.
3. Compara as contagens de linhas e a RLS com o manifesto.
4. Sobe Keycloak e API e confere `/ready` e o realm.
5. Destrói o ambiente.

O script recusa o nome do projeto de produção e qualquer volume já existente.

**Recuperação real** (servidor perdido): criar uma VPS nova (passos 1 a 4 da instalação) e baixar o último backup. Depois:

```bash
ops/restore.sh --backup ./restore-in --identity <chave> --env .env --project vapt-vupt --with-proxy --keep
```

Por fim, apontar o DNS para o novo IP.

## Continuidade (RPO/RTO)

Termos usados:

- **RPO:** quanto trabalho pode ser perdido.
- **RTO:** quanto tempo o serviço fica fora.

Os números abaixo são **metas propostas e estimativas**, não garantias. Viram compromisso só depois de medidos no provedor contratado, com ensaios periódicos.

| Nível | Solução | RPO (meta) | RTO (estimativa) | Custo incremental |
|---|---|---|---|---|
| **1. Piloto (proposto)** | Backup lógico diário externo e snapshot diário do provedor | **até 24 h** | **até 1 dia útil** em horário de suporte. Restauração medida: ~1 min com a imagem pronta. Somam-se criar a VPS, Docker, DNS (TTL de 5 min) e alguém disponível | incluído no [orçamento](CUSTOS.md#orçamento-a-aprovar-antes-de-qualquer-contratação) |
| 2. Backup mais frequente | `OnCalendar` a cada 4 ou 6 h | até 6 h | igual ao nível 1 | pequeno: mais cópias no B2 |
| 3. Arquivamento contínuo (WAL) | pgBackRest ou wal-g para o armazenamento externo, ou banco gerenciado com PITR | minutos | igual ao nível 1, ou menor com banco gerenciado | banco gerenciado: +US$ 30/mês (2 GB). WAL próprio: mais operação |
| 4. Redundância | Banco com standby, segunda VPS em outra zona e failover testado | minutos | minutos a 1 h | 2× a 3× a infraestrutura, mais operação contínua |

**O que precisa ficar claro para João e para clientes:**

- **Backup não evita indisponibilidade.** Ele permite voltar *depois* da falha, com perda de até o RPO. Enquanto a VPS estiver fora, ninguém usa o sistema.
- **Replicação não substitui backup.** Uma réplica copia também o erro: uma exclusão, uma migration errada ou um ataque chegam à réplica em segundos. Só uma cópia antiga, imutável e fora do servidor protege contra isso.
- **Recuperar exige mais que os dados:** autenticação (o banco do Keycloak está no backup), configurações e segredos (`.env` e chave age no cofre), acesso ao provedor e ao DNS, e uma pessoa que conheça o procedimento. Se o cofre ou a chave forem perdidos, o backup é inútil. Por isso a decisão 11 é crítica.
- **A nuvem depende de internet.** Sem conexão no estabelecimento, ou com o provedor fora, não há operação. Não há modo offline, fila local nem sincronização. Isso **não é prometido**.
- **Evoluções possíveis** (não iniciadas e não prometidas): modo de consulta offline (PWA), registro offline com sincronização e resolução de conflitos, e instalação híbrida com servidor local. Cada uma exige desenho de conflitos e de segurança e um ciclo próprio.

## Modalidades opcionais futuras (não padrão)

| Modalidade | O que muda | Requisitos próprios |
|---|---|---|
| Hospedagem dedicada a um cliente | Mesmo `deploy/cloud`, uma VPS só dele | Orçamento próprio (infraestrutura integral mais operação), contrato específico |
| Instalação local ou intranet | Mesmos arquivos. TLS com certificado interno ou do domínio do cliente, e backup externo do cliente | Servidor, nobreak, rede e responsável local. Prazos de suporte e acesso remoto a combinar |

Nenhuma delas exige fork: as diferenças ficam no `.env` e no Caddyfile.

## Resultados do ensaio isolado

Comando: `bash deploy/cloud/test/drill.sh`, numa máquina com Docker, sem domínio nem provedor. Usa CA de teste do Caddy, S3 falso (`rclone serve s3`) e segredos aleatórios descartáveis. Relatório da última execução: [drill-report.txt](../review/cycle-02/cloud/drill-report.txt). Resumo em [PRODUCT-CYCLE-02.md](../PRODUCT-CYCLE-02.md#lote-3--preparação-para-hospedagem-em-nuvem).

### Não executado e dependente de contratação

- certificado público ACME, porque não há domínio;
- DNS real e latência a partir do Brasil;
- desempenho e créditos de CPU no plano escolhido;
- teste de carga com usuários simultâneos;
- e-mail de recuperação de senha;
- bloqueio de objetos e regra de ciclo de vida no armazenamento real;
- alertas reais de monitor;
- primeiro ensaio de restauração na VPS do provedor;
- units `systemd` (escritas, mas não ativadas num servidor);
- revisão jurídica.

**A instalação de produção não está concluída nem iniciada.**
