# ADR 0001 — Modalidade padrão: Vapt-Vupt hospedado em nuvem e administrado pelo fornecedor

- **Estado:** proposta, aguardando aprovação de João. Nada foi contratado nem publicado.
- **Data:** 2026-11-09
- **Ciclo:** 02 (PR #11), preparação de hospedagem

## Contexto

Até o lote 2, a instalação documentada era o Compose de desenvolvimento, e o caminho previsto para um piloto supunha servidor, armazenamento e nobreak no estabelecimento. João corrigiu a direção. O padrão proposto passa a ser o serviço hospedado em nuvem, administrado pelo fornecedor. O estabelecimento contribui só com seus dispositivos e sua internet.

Restrições que valem para esta decisão:

- uma única base de código e uma única instalação multiempresa, sem forks, sem aplicações separadas e sem uma VPS obrigatória por cliente;
- a portabilidade existente é preservada: Compose de desenvolvimento, imagem Docker e configuração por variáveis de ambiente;
- nada pode ser prometido além do que foi testado: nem disponibilidade, nem atendimento 24 horas, nem tempo de recuperação.

## Decisão (proposta)

1. **Padrão comercial.** Uma instalação em nuvem do fornecedor atende todas as empresas clientes. O isolamento entre elas é lógico e já existe no código:
   - membership verificada no servidor;
   - RLS com `FORCE` no PostgreSQL;
   - papel de runtime sem `BYPASSRLS`;
   - chaves compostas por organização;
   - configuração versionada e logotipo por empresa.

   Cada empresa mantém identidade, módulos, navegação e aparência próprios ([AUTHORIZATION.md](../AUTHORIZATION.md)).
2. **Primeira etapa: uma VPS** com Docker Compose (`deploy/cloud/`).
   - **Serviços:** Caddy com TLS automático, aplicação, Keycloak e PostgreSQL.
   - **Exposição:** o banco não tem porta publicada, e o console do Keycloak só é acessível por túnel SSH.
   - **Limitação:** isto é **ponto único de falha, não alta disponibilidade.** Se a VPS, o disco ou a região do provedor falharem, o serviço para até ser restaurado.
3. **Backups lógicos cifrados fora do servidor**, com chave privada guardada pelo fornecedor e restauração ensaiada. Somam-se, de forma complementar, os snapshots do provedor.
4. **Ambientes separados.** O ensaio e a homologação usam outro projeto Compose, outros domínios e outros segredos (de preferência outra VPS). Nunca usam dados comerciais.
5. **Instalação local ou intranet, e hospedagem dedicada por cliente,** ficam como **modalidades opcionais futuras**, com requisitos e orçamento próprios. O mesmo código e a mesma imagem as suportam. O que muda é quem opera e quem paga a infraestrutura.

## Alternativas consideradas

| Alternativa | Por que não agora |
|---|---|
| Servidor no estabelecimento (padrão anterior) | Exige hardware, nobreak, backup e administração em cada cliente. O custo e o risco recaem sobre quem não tem equipe técnica. |
| Uma VPS ou instalação por cliente | Multiplica custo, atualizações e superfície de ataque. O isolamento lógico já é testado no código. Fica como opção paga e dedicada. |
| Kubernetes, réplicas e balanceador | Não há carga nem requisito de disponibilidade que os justifiquem. Aumentam custo e complexidade operacional para um operador só. |
| Banco gerenciado desde o início | Tira do fornecedor patch e backup do banco, mas pode custar mais que a VPS inteira (ver [CUSTOS.md](../cloud/CUSTOS.md)). É o primeiro passo de crescimento recomendado, por critérios objetivos. |
| Provedor de identidade SaaS em vez de Keycloak | Evitaria operar o Keycloak, mas cria custo por usuário e dependência externa. O código só depende de OIDC, então a troca continua possível. Decisão pendente. |

## Consequências

- O fornecedor passa a operar 24×7 *em termos de infraestrutura* (o servidor fica ligado sempre), mas **não** oferece atendimento 24 horas. Os limites estão em [RESPONSABILIDADES.md](../cloud/RESPONSABILIDADES.md).
- Sem internet no estabelecimento, não há operação. Modo offline e sincronização são evoluções futuras, não prometidas.
- Uma falha da VPS derruba todos os clientes ao mesmo tempo. O tempo de volta depende do procedimento de [OPERACAO.md](../cloud/OPERACAO.md) e de alguém disponível para executá-lo.
- Keycloak e PostgreSQL concorrem pela memória da mesma máquina. No ensaio, o Keycloak usou cerca de 620 MiB em repouso, o que levou à recomendação de 4 GB de RAM.

## Critérios para evoluir (medidos, não presumidos)

| Sinal | Ação proposta |
|---|---|
| Memória disponível abaixo de 15% por mais de uma semana, ou OOM em qualquer contêiner | Aumentar o plano da VPS (redimensionamento com reinício) |
| CPU média acima de 60% em horário comercial, ou créditos de CPU esgotando (planos com burst) | Aumentar o plano ou trocar para CPU dedicada |
| Banco acima de ~20 GB, restauração acima do RTO acordado, ou necessidade de RPO menor que 24 h | Separar o banco em serviço gerenciado com PITR, ou adotar arquivamento de WAL |
| Contrato que exija disponibilidade formal, ou receita que pague redundância | Banco com standby, segunda VPS em outra zona e um plano de failover testado |
| Cliente que exija dados fisicamente separados | Modalidade dedicada (opcional, orçamento próprio) |

## Decisões que dependem de João

Estão consolidadas em [RESPONSABILIDADES.md § Decisões pendentes](../cloud/RESPONSABILIDADES.md#decisões-pendentes-de-joão) e no [orçamento a aprovar](../cloud/CUSTOS.md#orçamento-a-aprovar-antes-de-qualquer-contratação).
