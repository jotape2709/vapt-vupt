# Vapt-Vupt em nuvem: responsabilidades e termos propostos

> **Situação:** este documento é uma **proposta** para João revisar. Ele não é contrato, não fixa preço e não foi apresentado a nenhum cliente. Cada item está marcado:
>
> - **Proposto:** recomendação técnica a aprovar.
> - **Decisão de João:** depende de critério comercial.
> - **Contratado:** só depois de assinado. Hoje não há nenhum.
>
> Decisão técnica de base: [ADR 0001](../adr/0001-hospedagem-em-nuvem.md). Custos: [CUSTOS.md](CUSTOS.md). Procedimentos: [OPERACAO.md](OPERACAO.md).

## Modelo de serviço (proposto)

- O cliente **usa** o Vapt-Vupt pelo navegador, em computador, tablet ou celular, no endereço do serviço.
- O fornecedor **hospeda e administra** tudo do lado do servidor: conta de hospedagem, aplicação, autenticação, banco, atualizações, monitoramento e backups.
- O cliente **paga pelo serviço**. A cobrança precisa cobrir infraestrutura, manutenção e suporte. No início, hospedagem e manutenção podem aparecer **discriminadas** na proposta, para transparência (formato: decisão de João).
- Todos os clientes compartilham a mesma instalação, com dados, permissões, arquivos e configurações separados por empresa. Nenhum cliente vê ou altera o que é de outro. Isso é testado a cada mudança: `tests/api.integration.test.ts` e `tests/e2e-real`.
- **Subsídio de piloto**, se houver, exige **teto de valor, prazo e critério de encerramento** definidos por João antes de qualquer oferta. Sem esses três itens, não há subsídio.

## Matriz de responsabilidades (proposta)

Legenda:

- **R:** responsável por executar.
- **A:** aprova ou decide.
- **C:** consultado.
- **I:** informado.
- **—:** não participa.

| Atividade | Fornecedor | Cliente | Provedor de nuvem |
|---|:-:|:-:|:-:|
| Contratar e pagar a conta de hospedagem, domínio e armazenamento de backup | R/A | — | — |
| Hardware, rede e energia do datacenter | I | — | R |
| Sistema operacional da VPS, firewall, SSH e atualizações de segurança | R | — | — (VPS não gerenciada) |
| Instalação, configuração e atualização da aplicação | R/A | I (aviso de janela) | — |
| Keycloak: operação, atualização e políticas de senha e bloqueio | R/A | — | — |
| Criar empresas e contas de acesso, e definir funções | R (executa) | A (indica quem e com qual função) | — |
| Banco de dados: operação, migrations e espaço | R | — | — |
| Backups cifrados fora do servidor e ensaios de restauração | R | I (resultado do ensaio, se contratado) | — |
| Snapshots do provedor (complementares) | R (configura) | — | R (executa) |
| Monitoramento de disponibilidade e de backup | R | — | — |
| Resposta a incidentes técnicos, dentro do horário acordado | R | C | C |
| Comunicação de incidente de segurança com dados pessoais | R (avisa o cliente) | R (decide como comunicar titulares e ANPD, como controlador) | C |
| Cadastro de produtos, movimentações e personalização da empresa | — | R | — |
| Exatidão dos dados digitados | — | R | — |
| Dispositivos, navegador atualizado e internet do estabelecimento | — | R | — |
| Pedir a exportação dos dados e o encerramento | I | R/A | — |
| Executar a exportação e a exclusão no encerramento | R | A | — |
| Pagar pelo serviço | — | R | — |

**LGPD (para análise jurídica, não é parecer):** no arranjo acima, o cliente tende a ser o **controlador** dos dados de sua empresa: nomes e e-mails dos usuários, registros de operação e auditoria. O fornecedor tende a ser **operador**, e o provedor de nuvem, suboperador. Se a VPS ou o backup ficarem fora do Brasil, há **transferência internacional**. O enquadramento, as cláusulas e os registros exigidos precisam de revisão por profissional habilitado antes da primeira venda. (Decisão de João.)

## Acesso aos dados e exportação (proposto)

- **Durante o serviço,** o cliente acessa seus dados pela aplicação, conforme as funções de cada pessoa. O fornecedor tem acesso técnico ao banco **somente** para operação, suporte pedido pelo cliente, backup e restauração. Esse acesso se dá pela conta administrativa, e as ações administrativas ficam em `audit_log`.
- **Exportação sob pedido:** o comando `npm run admin -- export --org <id>` gera um arquivo JSON legível. O arquivo contém configuração, unidades, funções, produtos, saldos, movimentações, logotipo e auditoria da empresa, sem nenhuma linha de outra empresa. O teste está em `tests/api.integration.test.ts`, e o ensaio em nuvem também exporta. **Ainda não há botão de exportação na interface nem exportação em planilha.** É uma evolução sugerida, não prometida.
- **Prazo de entrega da exportação:** decisão de João (campo pendente na [etapa 2](#etapa-2-antes-de-receber-dados-reais)). Dado técnico: o comando leva segundos; o prazo depende da disponibilidade de quem opera e do canal seguro de entrega.
- O que **não** está na exportação: senhas (ficam no Keycloak e nunca são exportáveis), sessões e tokens.

## Encerramento do serviço (proposto)

1. O proprietário da empresa pede o encerramento.
2. O fornecedor entrega a exportação JSON por canal seguro e confirma o recebimento.
3. O acesso dos usuários da empresa é revogado (`revoke` e `revoke-sessions`), e as contas no Keycloak são desativadas.
4. Depois de um **prazo de carência** para o cliente conferir a exportação (decisão de João, [etapa 3](#etapa-3-antes-de-cobrar-pelo-serviço)), os dados da empresa são excluídos do banco ativo.
5. Os backups antigos **não são editados**: são cifrados e expiram pela retenção do armazenamento externo (proposta técnica: 35 dias, que entra no orçamento; aprovação de João na [etapa 1](#etapa-1-para-aprovar-orçamento-e-contratação)). O cliente deve ser informado de que cópias cifradas persistem até expirar.

**Limitação atual:** ainda não existe um comando de **exclusão definitiva** de empresa. Movimentações e auditoria são append-only, protegidas por gatilho. A exclusão exige um procedimento administrativo próprio, a desenhar e testar antes do primeiro encerramento real. **Registrado como pendente; não prometer exclusão em prazo curto até que exista.**

## Suporte (limites propostos)

- **Canal e horário:** decisão de João. Exemplo de formato: dias úteis, horário comercial, por e-mail ou mensagem, com prazo de *primeira resposta*, nunca de solução.
- **Sem atendimento 24 horas** e **sem garantia de disponibilidade (SLA)**. A infraestrutura é uma VPS única, sem redundância, e só há um operador. Fora do horário, o monitoramento alerta, mas não há compromisso de ação imediata.
- **Metas de continuidade** (RPO/RTO) são metas internas propostas em [OPERACAO.md](OPERACAO.md#continuidade-rporto). Não são garantias contratuais enquanto não forem medidas no provedor escolhido, com ensaios periódicos.
- **Incluso (proposta):** dúvidas de uso, correção de defeitos, criação e remoção de usuários, ajuste de funções, exportação e restauração após falha do serviço.
- **Fora do escopo (proposta):**
  - suporte a dispositivos, redes ou internet do cliente;
  - correção de dados digitados errado pelo cliente (a reversão é feita por movimentação);
  - integrações;
  - novos módulos.
- **Janelas de atualização:** avisadas com antecedência e fora do horário de pico (horário: decisão de João). Incluem backup antes e uma verificação pública obrigatória depois (aplicação, banco e página de login).
  - Se a **nova versão** falha, a imagem anterior volta automaticamente, **desde que** as migrations da versão tenham sido declaradas e testadas como compatíveis com a anterior (ensaiado).
  - Se a falha é **externa** (rede, DNS, Keycloak, provedor), reverter não resolve, e o procedimento diz isso em vez de anunciar sucesso (ensaiado).
  - Se a versão traz mudança **incompatível**, não há reversão de imagem: a atualização exige janela com o serviço parado e um plano de recuperação escrito, normalmente a restauração do backup tirado na própria atualização ([OPERACAO.md](OPERACAO.md#atualização-e-reversão)).

## Condições hoje contratadas

**Nenhuma.** Nenhuma hospedagem, domínio, armazenamento, monitor ou serviço foi contratado. Nenhuma proposta foi apresentada a cliente.

## Decisões pendentes de João

### Proposta curta

**Modelo, mantido:** o Vapt-Vupt roda numa infraestrutura padrão, contratada e administrada pelo fornecedor e financiada pela cobrança do serviço. O estabelecimento não precisa de servidor: usa navegador e internet.

O que falta decidir está agrupado pelo momento em que cada decisão bloqueia o próximo passo. Os campos `____` são de João. Onde há **proposta técnica**, ela é só técnica: preço de venda, subsídio, garantias e horário de suporte ficam em branco de propósito.

| Etapa | Libera | Decisões |
|---|---|---|
| 1 | Contratar a infraestrutura (sem dados de clientes) | 7 |
| 2 | Receber dados reais, mesmo de um piloto gratuito | 6 |
| 3 | Cobrar pelo serviço | 6 |
| 4 | Evoluções posteriores, por critério medido | 5 |

### Etapa 1: para aprovar orçamento e contratação

| # | Decisão | Campo | Impacto | Proposta técnica |
|---|---|---|---|---|
| 1.1 | Provedor, plano e **região do banco principal** (a VPS) | `____` | Custo, latência, LGPD | Lightsail São Paulo 4 GB, depois de cotar a Magalu Cloud ([CUSTOS.md](CUSTOS.md)) |
| 1.2 | Provedor e **região dos backups externos** (decisão separada da 1.1) | `____` | Se ficar fora do Brasil, há transferência internacional mesmo com a VPS no Brasil | Ver [residência dos dados](CUSTOS.md#residência-dos-dados) |
| 1.3 | **Orçamento mensal estimado** e valor do **alerta** de cobrança | `US$ ____` / alerta em `____` | Alerta avisa, não bloqueia gasto | [Orçamento](CUSTOS.md#orçamento-a-aprovar-antes-de-qualquer-contratação) |
| 1.4 | Titular da conta e do cartão; folga de câmbio para o orçamento em reais | `____` / `____ %` | Cobrança em dólar com IOF | — |
| 1.5 | Domínio da marca e subdomínios da aplicação e do login | `____` | Necessário para TLS e instalação | — |
| 1.6 | Cofre da chave privada de backup e do `.env`; quem tem acesso de emergência | `____` | Sem isso, uma restauração pode ficar impossível | Cofre de senhas com dois titulares |
| 1.7 | Retenção dos backups externos | `____ dias` | Custo de armazenamento e prazo em que dados excluídos ainda existem em cópias cifradas | 35 dias diários |

### Etapa 2: antes de receber dados reais

| # | Decisão | Campo | Impacto |
|---|---|---|---|
| 2.1 | Revisão jurídica: papéis na LGPD, transferência internacional (se 1.1 ou 1.2 fora do Brasil), termo de uso e política de privacidade | responsável `____` | Sem ela, não há base para tratar dados de clientes |
| 2.2 | MFA obrigatório para proprietários e para a administração do Keycloak | `sim / não / só administração` | Segurança × atrito de uso |
| 2.3 | Recuperação de senha: e-mail (provedor SMTP e remetente) ou atendimento manual | `____` | Hoje desligada; quem esquece a senha depende do fornecedor |
| 2.4 | Aprovar o primeiro ensaio de restauração **no provedor real** como condição para receber dados | `sim / não` | O ensaio atual é em máquina isolada; o tempo no provedor não foi medido |
| 2.5 | Prazo e canal seguro para entregar a exportação a pedido do cliente | `____` | Compromisso que o cliente vai cobrar |
| 2.6 | Quem pode pedir criação de contas e funções em nome do cliente | `____` | Evita conceder acesso a quem não deveria |

### Etapa 3: antes de cobrar pelo serviço

| # | Decisão | Campo | Impacto |
|---|---|---|---|
| 3.1 | Preço ao cliente, moeda, reajuste e se hospedagem e manutenção aparecem separadas | `R$ ____` | Precisa cobrir infraestrutura ([CUSTOS.md](CUSTOS.md)), horas de operação e suporte |
| 3.2 | Subsídio de piloto: existe? Se sim, teto de valor, prazo e critério de encerramento | `____` / `R$ ____` / `____` / `____` | Sem os três, não há subsídio |
| 3.3 | Horário, canal e prazo de **primeira resposta** do suporte | `____` | Precisa caber no que um operador consegue cumprir |
| 3.4 | Garantias oferecidas: disponibilidade, perda máxima de dados (RPO) e tempo de volta (RTO) | `____` | Hoje só há **metas internas não medidas no provedor**; não há base para garantia contratual |
| 3.5 | Carência no encerramento e horário das janelas de atualização | `____ dias` / `____` | Itens de contrato |
| 3.6 | Procedimento de exclusão definitiva de empresa, desenhado e testado | aprovar | Hoje não existe; não prometer prazo de exclusão antes disso |

### Etapa 4: evoluções posteriores

| # | Decisão | Gatilho |
|---|---|---|
| 4.1 | Manter Keycloak próprio ou usar provedor de identidade gerenciado | Custo × horas de operação medidas |
| 4.2 | Banco gerenciado com recuperação a um ponto no tempo (PITR) | [Critérios do ADR](../adr/0001-hospedagem-em-nuvem.md#critérios-para-evoluir-medidos-não-presumidos) |
| 4.3 | Exportação pela interface e em planilha | Pedidos de clientes |
| 4.4 | Monitor pago com intervalo de 1 minuto | Contrato que exija |
| 4.5 | Modalidades opcionais: instalação local ou hospedagem dedicada por cliente | Pedido com orçamento próprio |
