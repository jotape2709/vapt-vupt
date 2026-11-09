# Vapt-Vupt em nuvem: comparação de custos e orçamento a aprovar

> **Situação:** pesquisa feita em 2026-11-09 e revisada no mesmo dia, depois da revisão do lote 3, só nas páginas oficiais de cada provedor. **Nada foi contratado.**
>
> - Os preços são os publicados nesse dia, sem impostos, salvo indicação.
> - Valores **medidos** vêm do ensaio isolado ([OPERACAO.md](OPERACAO.md#resultados-do-ensaio-isolado)).
> - Valores **estimados** são hipóteses e trazem a forma de validação.
> - **Nenhum valor aqui é teto garantido.** Só o preço do plano da VPS é fixo por mês; os demais itens variam com o uso, e os alertas de cobrança avisam, mas não bloqueiam gasto ([alerta × limite](#alerta-de-cobrança-não-é-limite-de-gasto)).
> - Não há aqui preço de venda, margem nem lucratividade: isso é [decisão de João](RESPONSABILIDADES.md#decisões-pendentes-de-joão).

## O que a instalação consome (medido)

Medição no ensaio da pilha completa de `deploy/cloud`, com Caddy, aplicação, Keycloak e PostgreSQL, ociosa depois de login e operações:

| Serviço | Memória | Limite configurado |
|---|---|---|
| Keycloak 26 (JVM) | ~620 MiB | 1 GiB (`VV_KEYCLOAK_MEMORY`) |
| PostgreSQL 17 | ~68 MiB, mais o cache de disco do sistema | sem limite |
| Aplicação (Node 22) | ~45 MiB | 512 MiB |
| Caddy | ~22 MiB | sem limite |

Outras medições:

- **Imagens:** aplicação 387 MB. Keycloak, PostgreSQL, Caddy e rclone somam cerca de 1,5 GB em disco.
- **Volume do banco** recém-instalado, com o realm do Keycloak: ~79 MB.
- **Crescimento do banco** (medido com 200 mil movimentações e 5 mil produtos sintéticos num PostgreSQL 17 descartável):
  - ~**1,0 KB por movimentação** e ~0,46 KB por produto, incluindo índices;
  - dump compactado de ~10 MB para 200 mil movimentações. Esse dump é **otimista**, porque os dados sintéticos se repetem e comprimem mais que os reais.
- **Não medido:** carga com usuários simultâneos. A capacidade por plano abaixo é **hipótese**. A validação proposta é um teste de carga numa VPS de homologação do plano escolhido, antes de passar do piloto. O teste mede o p95 das rotas de estoque e de movimentação com 10, 30 e 60 sessões simultâneas.

**Consequência para o dimensionamento:**

- **2 GB de RAM não é recomendado.** O Keycloak sozinho usa cerca de 620 MiB em repouso. Somando sistema operacional, Docker, PostgreSQL, picos de login e `pg_dump` do backup, sobra pouca margem.
- **4 GB é o mínimo sustentável proposto para o piloto.**
- **40 GB de disco bastam no piloto, e 80 GB dão folga** para imagens, logs (rotação de 50 MB por serviço) e 7 backups locais.

## Premissas dos cenários (hipóteses a validar)

| Premissa | Piloto | Crescimento | Como validar |
|---|---|---|---|
| Empresas | 3 a 5 | ~30 | contrato |
| Usuários simultâneos (total) | até 10 | até 60 | logs da API (sessões ativas) e teste de carga |
| Produtos por empresa | até 3.000 | até 5.000 | `export` / contagem no banco |
| Movimentações por empresa por dia | até 300 | até 500 | `inventory_events` por dia |
| Banco após 12 meses | ~0,6 GB | ~5,5 GB | `pg_database_size` mensal |
| Retenção | movimentações e auditoria por tempo indeterminado (append-only); backups: 7 locais e 35 diários externos | igual | política aprovada por João |
| Tamanho de cada backup cifrado após 12 meses | 50–170 MB | 0,5–1,6 GB | tamanho real em `ops/backup.sh` |
| Armazenamento externo (35 cópias) | 2–6 GB | 20–60 GB | uso no provedor |
| Tráfego mensal | < 50 GB | < 300 GB | painel do provedor |

O tráfego é baixo porque a interface é estática, com ~405 kB e 123 kB gzip, guardada em cache pelo navegador, e porque a API devolve páginas de 50 itens. Mesmo no cenário de crescimento, o tráfego fica muito abaixo de qualquer franquia listada.

## Opções pesquisadas (fontes oficiais, 2026-11-09)

### A. AWS Lightsail — São Paulo (`sa-east-1`) — **recomendada para o piloto**

Fontes: <https://aws.amazon.com/lightsail/pricing/> (página atualizada em 2026-11-05) e <https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html>.

**Planos Linux com IPv4 incluído (USD/mês):**

| Plano | vCPU | Disco SSD | Franquia de transferência |
|---|---|---|---|
| 2 GB: US$ 12 | 2 | 60 GB | 3 TB |
| **4 GB: US$ 24** | **2** | **80 GB** | **4 TB** |
| 8 GB: US$ 44 | 2 | 160 GB | 5 TB |

A página diz que os planos de **São Paulo têm metade da franquia de transferência**: 4 GB → 2 TB, ainda folgado. Ela **não** imprime uma tabela de preço separada para São Paulo. **Confirmar o preço no console antes de contratar.**

**Banco gerenciado (padrão / alta disponibilidade, USD/mês):**

| Plano | Padrão | Alta disponibilidade | Observação |
|---|---|---|---|
| 1 GB, 40 GB | US$ 15 | US$ 30 | **sem criptografia: descartado** |
| 2 GB, 80 GB | **US$ 30** | **US$ 60** | |
| 4 GB, 120 GB | US$ 60 | US$ 120 | |

**Outros itens:**

- Snapshots (manuais e automáticos): US$ 0,05 por GB-mês. Os automáticos são diários e o Lightsail guarda **os 7 mais recentes**; a documentação não mostra ajuste dessa quantidade (<https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-configuring-automatic-snapshots.html>). **Nem a página de preços nem a de snapshots dizem se a cobrança é pelo tamanho cheio ou só pelos blocos alterados** ([cálculo abaixo](#snapshots-do-provedor-cálculo-com-retenção)).
- Object storage: US$ 1 (5 GB) / US$ 3 (100 GB).
- Excedente de transferência em São Paulo, no object storage: US$ 0,15/GB.

**Prós:**

- dados no Brasil e menor latência para clientes brasileiros;
- franquia fixa;
- snapshots automáticos do próprio provedor;
- banco gerenciado no mesmo painel, quando chegar a hora.

**Contras e cuidados:**

- cobrança em dólar;
- conta AWS exige cuidado de segurança (MFA, alerta de cobrança);
- instâncias Lightsail têm CPU com "burst": a linha de base do plano de 4 GB é **20% por vCPU** (<https://docs.aws.amazon.com/lightsail/latest/userguide/baseline-cpu-performance.html>). Uso contínuo acima disso consome créditos e, esgotados, a CPU cai para a linha de base; o teste de carga precisa medir isso;
- o 1 vCPU vale para instâncias criadas antes de 2023 (nota da página), o que não se aplica a uma conta nova.

### B. Hetzner Cloud — Alemanha/Finlândia — menor preço, com ressalvas

Fontes: <https://www.hetzner.com/cloud/cost-optimized/>, <https://www.hetzner.com/cloud/regular-performance/>, <https://www.hetzner.com/storage/object-storage/>, <https://docs.hetzner.com/cloud/servers/backups-snapshots/overview>.

**Planos (EUR/mês, sem IVA, IPv4 incluído, 20 TB de tráfego na UE):**

| Plano | vCPU | RAM | Disco NVMe | Preço |
|---|---|---|---|---|
| CX23 | 2 | 4 GB | 40 GB | **€ 5,99** |
| CX33 | 4 | 8 GB | 80 GB | **€ 8,99** |
| CPX22 | 2 AMD | 4 GB | 80 GB | € 19,99 |
| CPX32 | 4 | 8 GB | 160 GB | € 35,99 |

**Outros itens:**

- Backups automáticos: 7 cópias diárias, "a partir de € 1,198/mês", com preço proporcional ao servidor. **A página não informa o percentual.**
- Snapshots: € 0,0143 por GB-mês.
- Object Storage: € 6,49/mês com 1 TB de armazenamento e 1 TB de saída.

**Ressalvas que impedem recomendar sem verificação:**

1. **Disponibilidade por plano, não do provedor inteiro.** Na leitura de 2026-11-09, o HTML das páginas marcava **cada plano** com "This product is currently unavailable": todos os CX e CAX (*cost-optimized*, só UE) e também todos os CPX (*regular performance*, UE, EUA e Singapura). Nenhuma página declara um local esgotado nem a Hetzner inteira indisponível. Como a marcação aparece de forma idêntica em todos os planos, ela pode refletir estoque real ou um estado padrão da página: **só o console da Hetzner confirma**. Os planos dedicados (CCX) não foram consultados.
2. Os planos baratos (CX/CAX) só existem na UE (Nuremberg, Falkenstein, Helsinque). Os CPX existem também nos EUA (Ashburn, Hillsboro) e em Singapura, por preços maiores (ex.: CPX21 nos EUA, 3 vCPU/4 GB, € 32,49). A latência do Brasil até a UE é maior, ~200 ms de ida e volta: **estimativa, não medida**.
3. Os dados ficariam fora do Brasil: transferência internacional pela LGPD, a avaliar.
4. Não há banco gerenciado na Hetzner Cloud.
5. Backups automáticos: 7 por servidor, "a partir de € 1,198/mês", com preço ligado ao plano. € 1,198 é 20% de € 5,99, mas **a página não declara o percentual**.
6. A cobrança de IVA para cliente fora da UE não foi verificada.

### C. DigitalOcean — sem região no Brasil

Fontes: <https://www.digitalocean.com/pricing/droplets>, <https://www.digitalocean.com/pricing/backups>, <https://www.digitalocean.com/pricing/managed-databases>, <https://www.digitalocean.com/pricing/spaces-object-storage>.

**Droplets Basic (USD/mês):**

| Plano | vCPU | Disco SSD | Transferência | Preço |
|---|---|---|---|---|
| 2 GiB | 1 | 50 GiB | 2 TB | US$ 12 |
| 2 GiB | 2 | 60 GiB | 3 TB | US$ 18 |
| **4 GiB** | **2** | **80 GiB** | **4 TB** | **US$ 24** |
| 8 GiB | 4 | 160 GiB | 5 TB | US$ 48 |

**Outros itens:**

- Backups: semanais +20% do droplet, ou diários +30% (4 GiB: US$ 4,80 ou US$ 7,20).
- PostgreSQL gerenciado, nó único: 1 GiB US$ 15,15; 2 GiB US$ 30,45; 4 GiB US$ 60,90. O preço do nó *standby* não aparece na página.
- Spaces: US$ 5/mês com 250 GiB e 1 TiB de saída.
- Regiões listadas: EUA, Canadá, Europa e Ásia/Oceania. **Nenhuma na América do Sul**, conforme as páginas lidas (o FAQ diz "including", então confirmar).

**Prós:** painel simples e banco gerenciado no mesmo provedor.
**Contras:** dados e latência fora do Brasil, e custo igual ou maior que a opção A para o mesmo porte.

### D. Magalu Cloud — Brasil, em reais — **não cotado**

Fontes: <https://magalu.cloud/precos/>, <https://magalu.cloud/virtual-machines/>, <https://magalu.cloud/dbaas/>.

As páginas oficiais carregam os preços por uma calculadora em JavaScript, que não pôde ser lida nesta pesquisa. O site destaca cobrança em real "sem flutuações cambiais" e dados no Brasil, o que eliminaria o risco de câmbio e o IOF.

**Ação proposta:** João (ou eu, com acesso a um navegador comum) consulta a calculadora para VM de 2 vCPU / 4 GB e 4 vCPU / 8 GB, banco gerenciado PostgreSQL e object storage, antes de decidir entre A e D.

### Backup externo e monitoramento

| Serviço | Preço oficial (2026-11-09) | Uso proposto | Fonte |
|---|---|---|---|
| Backblaze B2 | US$ 6,95/TB-mês; 10 GB gratuitos; saída gratuita até 3× o armazenado; sem cobrança por duração mínima. Regiões: EUA Oeste, EUA Leste, UE Central (Amsterdã) e Canadá Leste; **nenhuma na América do Sul**; a região da conta não muda depois de criada. Object Lock pela API S3, sem custo extra | **Destino externo dos backups** (outro provedor = falha independente da VPS). Piloto (2–6 GB) cabe na faixa gratuita | <https://www.backblaze.com/cloud-storage/pricing>, <https://www.backblaze.com/docs/cloud-storage-data-regions>, <https://www.backblaze.com/docs/cloud-storage-object-lock> |
| Cloudflare R2 | US$ 0,015/GB-mês; 10 GB gratuitos; saída gratuita | Alternativa ao B2 | <https://developers.cloudflare.com/r2/pricing/> |
| UptimeRobot (Free) | US$ 0; 50 monitores; intervalo de 5 min; uso comercial permitido na página | Monitor externo de `https://<app>/ready` e da página de login | <https://uptimerobot.com/pricing/> |
| Healthchecks.io (Hobbyist) | US$ 0; 20 verificações | "Heartbeat" do backup diário (`VV_BACKUP_HEARTBEAT_URL`): alerta se o backup **não** rodar | <https://healthchecks.io/pricing/> |

O backup usa rclone, então qualquer armazenamento compatível com S3 serve. **O destino deve ser de outro provedor**, porque um backup na mesma conta da VPS não protege contra perda ou bloqueio dessa conta.

### Impostos e câmbio

- Cobranças em USD ou EUR no cartão incidem **IOF**. O Decreto nº 12.499/2025 (<https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12499.htm>) fixou 3,5% para compras internacionais com cartão. **Confirmar a alíquota vigente com o contador**, porque o decreto teve contestação judicial e legislativa.
- Se a contratação for por CNPJ, pode haver tributos sobre importação de serviços (IRRF, PIS/COFINS-Importação, CIDE, ISS), conforme o enquadramento. **Isso depende de contador.**
- **Câmbio:** a cotação PTAX do Banco Central não pôde ser lida nesta pesquisa (página só em JavaScript e API bloqueada pela rede do ambiente). Conversão: `R$ = valor_USD × PTAX_venda_do_dia × (1 + IOF)`. Para orçamento, sugiro usar uma folga de câmbio definida por João.

## Residência dos dados

A região do **banco principal** e a dos **backups** são decisões separadas ([etapa 1 das decisões](RESPONSABILIDADES.md#etapa-1-para-aprovar-orçamento-e-contratação), itens 1.1 e 1.2). Uma VPS no Brasil com backup fora do Brasil ainda é transferência internacional.

| Dado | Onde fica na proposta | Alternativa no Brasil | Custo da alternativa |
|---|---|---|---|
| Banco principal (aplicação e Keycloak), sessões, logs | VPS Lightsail em São Paulo (`sa-east-1`) | já está | — |
| Snapshots do provedor | mesma região da VPS (São Paulo) | já está | — |
| Backups lógicos cifrados (externos) | Backblaze B2, região **EUA ou UE** (não há região na América do Sul) | Amazon S3 em São Paulo com Object Lock; Lightsail object storage em São Paulo; Magalu Cloud Object Storage ("hospedado integralmente no Brasil", com versionamento) | S3 São Paulo: preço não legível na página estática. Lightsail: pacote de US$ 1 com 5 GB, excedente de US$ 0,023/GB em São Paulo. Magalu: preço só na calculadora JavaScript, e a página não menciona bloqueio de objetos |

**Troca a considerar:** backup no mesmo provedor da VPS (S3 ou Lightsail na AWS) mantém os dados no Brasil, mas perde parte da independência: um bloqueio ou erro na conta AWS atinge VPS e backup juntos. Mitigações possíveis são uma conta AWS separada só para backup, com Object Lock em modo *compliance*, ou a Magalu Cloud (outro provedor e no Brasil), desde que se confirme o bloqueio contra exclusão. **Decisão de João, com a revisão jurídica.**

Os backups são cifrados com `age` antes de sair do servidor, e a chave privada não fica no provedor. A cifra reduz o risco de exposição, mas não muda o local dos dados para fins da LGPD.

## Proteção dos backups contra exclusão

- `rclone copy --immutable`, usado em `ops/backup.sh`, só faz o rclone **recusar sobrescrever** um arquivo que já existe no destino. A documentação do rclone diz que arquivos ainda podem ser apagados (<https://rclone.org/docs/#immutable>). **Não protege contra exclusão** por credencial vazada, erro de operação ou ransomware.
- A proteção real é do provedor de armazenamento: **bloqueio de objetos (Object Lock)** em modo *compliance* com retenção igual à política aprovada (proposta: 35 dias), mais uma credencial de backup que só grava (sem permissão de apagar). O B2 e o S3 oferecem Object Lock. No B2, o bloqueio não pode ser desligado depois de ativado no bucket.
- A expiração das cópias antigas fica a cargo de uma regra de ciclo de vida do bucket, não do script.
- **Nada disso foi testado:** o ensaio usa o S3 simulado do rclone, que não implementa Object Lock. Configuração e teste ficam para o provedor real ([testado × dependente do provedor](#testado-no-s3-simulado--dependente-do-provedor-real)).

## Snapshots do provedor: cálculo com retenção

A versão anterior deste documento estimava "≤ US$ 4" como um único snapshot de 80 GB. Isso ignorava a retenção de **7 snapshots diários** e o crescimento dos blocos guardados. Refeito:

- Premissa de uso do disco no piloto: sistema e Docker ~6 GB, mais o banco (até ~0,6 GB em 12 meses) e 7 backups locais (até ~1,2 GB): **~8 GB no início e ~10 GB após 12 meses**. É estimativa; o valor real sai de `df` na VPS.
- Mudança diária estimada nos blocos: 0,3 a 1 GB (logs, backup local do dia, banco, atualizações).

| Forma de cobrança | Conta | Piloto, início | Piloto, 12 meses |
|---|---|---|---|
| Incremental (só blocos alterados; é como snapshots de volumes EBS funcionam, mas **a página do Lightsail não afirma isso**) | uso + 6 × mudança diária | 9,8–14 GB → **US$ 0,49–0,70** | 11,8–16 GB → **US$ 0,59–0,80** |
| Cada snapshot pelo uso cheio | 7 × uso | 56 GB → **US$ 2,80** | 70 GB → **US$ 3,50** |
| Cada snapshot pelo disco provisionado (pior caso, improvável, não descartado pela documentação) | 7 × 80 GB | **US$ 28,00** | **US$ 28,00** |

**Proposta:** orçar **US$ 4/mês** (cobre os dois primeiros casos) e **conferir a linha "snapshot" da primeira fatura semanal**. Se aparecer o pior caso, desligar os snapshots automáticos: os backups lógicos externos continuam sendo a cópia principal, e os snapshots são só complementares.

## Alerta de cobrança não é limite de gasto

- **AWS Budgets** envia avisos quando o gasto real ou previsto passa de um valor. A documentação diz que os dados são atualizados até três vezes por dia e que **o gasto pode continuar e passar do limite antes do aviso** (<https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html>).
- As **ações de orçamento** podem aplicar uma política de permissão ou agir sobre instâncias EC2 e RDS. **O Lightsail não é citado** (<https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html>), então não há, na AWS, desligamento automático da VPS por gasto. Mesmo que houvesse, desligar a VPS derrubaria todos os clientes.
- **Backblaze B2:** não encontrei, nas páginas lidas, um limite de gasto que pare o serviço. A página de limites e alertas não abriu na pesquisa: **verificar no painel**.
- **O que limita de fato:** o preço do plano da VPS é fixo por mês. A franquia de transferência só gera excedente acima de 2 TB em São Paulo, muito acima do previsto. Os itens variáveis (snapshots, armazenamento de backup, excedentes) **não têm limite**; só alerta e conferência mensal.

## O que entra e o que não entra no orçamento

| Situação | Itens |
|---|---|
| **Incluído** | VPS (preço fixo do plano); snapshots automáticos (estimativa acima); backup externo até a faixa gratuita do B2; monitores gratuitos |
| **Excluído** (cobrado ou decidido à parte) | IOF e tributos de importação de serviço; domínio; envio de e-mail (SMTP); horas de implantação, manutenção, suporte e ensaios ([custos que não são infraestrutura](#custos-que-não-são-infraestrutura-separados)); VPS temporária de ensaio; banco gerenciado; plano pago de monitor |
| **Incerto** (depende de confirmação no provedor) | preço exato em São Paulo no console; forma de cobrança dos snapshots; excedentes de transferência (improváveis); disponibilidade da Hetzner por plano; preços da Magalu Cloud; preço do S3 em São Paulo se o backup ficar no Brasil; câmbio (PTAX) e alíquota de IOF vigente |

## Testado no S3 simulado × dependente do provedor real

| Testado no ensaio isolado (`rclone serve s3` local) | Depende do provedor real (não testado) |
|---|---|
| Cifra com `age` antes do envio e ausência de texto claro nos arquivos | Credenciais, região e endpoint reais; latência e banda até o provedor |
| Envio com `rclone copy`, conferência com `rclone check --one-way` | Object Lock, retenção e ciclo de vida do bucket |
| Download e restauração em projeto separado, com verificação dos invariantes | Credencial que só grava, sem permissão de apagar |
| Recusa com chave errada | Custo real de armazenamento, requisições e saída |
| | Tempo de download de um backup grande no momento da recuperação |

## Comparação para o mesmo porte (4 GB, piloto)

USD/mês, sem impostos.

| Item | A. Lightsail SP | B. Hetzner CX23 (UE) | C. DigitalOcean (EUA) |
|---|---|---|---|
| VPS 4 GB (com IPv4 e tráfego) | 24,00 | € 5,99 (indisponível na data) | 24,00 |
| Cópias do provedor (snapshot/backup) | ~4,00 (estimativa com 7 snapshots retidos; [cálculo](#snapshots-do-provedor-cálculo-com-retenção)) | € 1,20+ (percentual não informado) | 7,20 (diário) |
| Backup externo (B2, ≤ 10 GB) | 0,00 | 0,00 | 0,00 |
| Monitor externo e heartbeat | 0,00 | 0,00 | 0,00 |
| **Total de infraestrutura (estimativa)** | **~28,00** | **~€ 7,20** (se disponível) | **31,20** |
| Dados no Brasil | sim | não | não |
| Banco gerenciado disponível no mesmo provedor | sim | não | sim |

**Recomendação: opção A**, com a opção D cotada antes de decidir. O critério não é o menor preço. A opção A combina:

- dados no Brasil e menor latência;
- franquia fixa;
- snapshots gerenciados;
- caminho de crescimento (banco gerenciado) no mesmo provedor.

A diferença para a opção B (cerca de US$ 20/mês) compra disponibilidade de pedido, localização dos dados e latência, que não puderam ser garantidas na opção B.

### Alternativa com banco gerenciado (mesmo provedor)

| Composição | USD/mês | Observação |
|---|---|---|
| A + Lightsail Managed DB 2 GB padrão | 24 + 30 = **54** | Tira do fornecedor patch e backup do PostgreSQL (confirmar retenção e PITR na documentação). A VPS continua sendo ponto único de falha da aplicação e do Keycloak |
| A + Lightsail Managed DB 2 GB alta disponibilidade | 24 + 60 = **84** | Banco com standby. A aplicação continua numa VPS só |
| C + DO PostgreSQL 1 GiB | 24 + 15,15 = **39,15** | Banco de 1 GiB é apertado para Keycloak e aplicação juntos |

Para o piloto, o ganho do banco gerenciado não justifica de 2× a 3× o custo. Os critérios para migrar estão no [ADR](../adr/0001-hospedagem-em-nuvem.md#critérios-para-evoluir-medidos-não-presumidos).

### Cenário de crescimento (~30 empresas)

| Item | USD/mês | Observação |
|---|---|---|
| Lightsail 8 GB (São Paulo) | 44 | ou 4 GB + banco gerenciado 2 GB (54), se o banco passar dos critérios |
| Snapshots | ~4 a 8 | estimativa, mesma conta acima com o disco maior |
| Backup externo B2 (20–60 GB) | 0,07–0,35 | US$ 6,95/TB acima de 10 GB |
| Monitor com intervalo de 1 min e mais recursos (opcional) | 12 | UptimeRobot Solo, cobrança anual |
| **Total** | **~52 a ~64** | Hipótese. Depende do teste de carga |

## Custos que não são infraestrutura (separados)

Valores em horas são **estimativas iniciais minhas, a validar**. O preço da hora é decisão de João.

| Categoria | Itens | Estimativa |
|---|---|---|
| **Implantação** (uma vez) | Conta no provedor com MFA e alerta de cobrança, domínio e DNS, endurecimento da VPS (SSH por chave, firewall, atualizações automáticas), `ops/install.sh`, admin nominal no Keycloak com MFA, backup externo e monitores, primeiro ensaio de restauração no provedor real, criação das empresas e contas | 8–12 h |
| **Manutenção** (mensal) | Atualizações do sistema e das imagens, conferência dos backups e alertas, espaço em disco, revisão de logs | 2–4 h/mês |
| **Ensaio de restauração** (trimestral) | `ops/restore.sh` numa VPS temporária e registro do resultado | 1–2 h por trimestre, mais algumas horas de VPS temporária (< US$ 1) |
| **Suporte** | Conforme horário e limites aprovados ([RESPONSABILIDADES.md](RESPONSABILIDADES.md#suporte-limites-propostos)) | depende da adesão |
| **Serviços externos e contingência** | Domínio (anual, preço no registro.br, a verificar); envio de e-mail para recuperação de senha (pendente); reserva para crescimento e câmbio | a definir |

## Orçamento a aprovar antes de qualquer contratação

Proposta para João aprovar ou ajustar. **Nada será contratado sem essa aprovação.**

| Item | Valor mensal | Natureza | Base |
|---|---|---|---|
| VPS Lightsail 4 GB, São Paulo | US$ 24,00 | **fixo** pelo plano | preço oficial, a confirmar no console |
| Snapshots automáticos (7 retidos) | US$ 4,00 | **estimativa**, variável | [cálculo](#snapshots-do-provedor-cálculo-com-retenção); conferir na primeira fatura |
| Backup externo Backblaze B2 | US$ 1,00 | **estimativa**, variável | faixa gratuita de 10 GB, com folga |
| Monitoramento (UptimeRobot e Healthchecks, gratuitos) | US$ 0,00 | gratuito enquanto o plano existir | planos gratuitos |
| **Estimativa mensal de infraestrutura do piloto** | **~US$ 29,00 + IOF/tributos** | **não é teto** | |
| Domínio (anual) | a cotar | excluído | registro.br |
| VPS temporária para ensaio de restauração | < US$ 1 por ensaio | excluído, por hora | cobrança por hora |

Também precisam de aprovação: a política de retenção (7 locais e 35 externos), o valor do alerta de cobrança (que **avisa, não bloqueia**; sugestão técnica: 120% da estimativa, mais um alerta de previsão) e quem guarda as credenciais ([etapa 1 das decisões](RESPONSABILIDADES.md#etapa-1-para-aprovar-orçamento-e-contratação)).
