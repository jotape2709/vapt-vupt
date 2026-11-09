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
- **Prazo de entrega da exportação:** decisão de João. Sugestão: até 5 dias úteis após o pedido do proprietário da empresa.
- O que **não** está na exportação: senhas (ficam no Keycloak e nunca são exportáveis), sessões e tokens.

## Encerramento do serviço (proposto)

1. O proprietário da empresa pede o encerramento.
2. O fornecedor entrega a exportação JSON por canal seguro e confirma o recebimento.
3. O acesso dos usuários da empresa é revogado (`revoke` e `revoke-sessions`), e as contas no Keycloak são desativadas.
4. Depois de um **prazo de carência** para o cliente conferir a exportação (sugestão: 30 dias, decisão de João), os dados da empresa são excluídos do banco ativo.
5. Os backups antigos **não são editados**: são cifrados e expiram pela retenção do armazenamento externo. Sugestão de retenção: 35 dias, decisão de João. O cliente deve ser informado de que cópias cifradas persistem até expirar.

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
- **Janelas de atualização:** avisadas com antecedência e fora do horário de pico (horário: decisão de João). Normalmente levam minutos e incluem backup antes. A reversão é automática se a nova versão não iniciar (testado).

## Condições hoje contratadas

**Nenhuma.** Nenhuma hospedagem, domínio, armazenamento, monitor ou serviço foi contratado. Nenhuma proposta foi apresentada a cliente.

## Decisões pendentes de João

| # | Decisão | Por que importa |
|---|---|---|
| 1 | Provedor e plano da VPS, dentre as opções de [CUSTOS.md](CUSTOS.md) | Define custo, latência, região dos dados e LGPD |
| 2 | Aprovar o [orçamento mensal de infraestrutura](CUSTOS.md#orçamento-a-aprovar-antes-de-qualquer-contratação) e quem paga o cartão | Nada é contratado sem isso |
| 3 | Preço ao cliente, separação hospedagem × manutenção, reajuste e moeda | Sem isso não há proposta comercial |
| 4 | Subsídio de piloto: teto, prazo e critério de encerramento | Exigido para qualquer piloto subsidiado |
| 5 | Horário e canal de suporte, e prazo de primeira resposta | Limita o compromisso ao que um operador consegue cumprir |
| 6 | Prazos de exportação, de carência no encerramento e de retenção de backup | Itens de contrato e LGPD |
| 7 | Domínio da marca (ex.: `.com.br`) e subdomínios da aplicação e do login | Necessário para TLS e para a instalação |
| 8 | Região dos dados: Brasil ou exterior | Latência, LGPD e custo |
| 9 | Recuperação de senha por e-mail: provedor de envio (SMTP) e remetente | Hoje desligada. Sem ela, quem esquece a senha precisa do fornecedor |
| 10 | MFA obrigatório para proprietários e administradores do Keycloak | Segurança × atrito de uso |
| 11 | Onde guardar a chave privada de backup e o `.env` (cofre de senhas), e quem mais tem acesso de emergência | Sem isso, uma restauração pode ficar impossível |
| 12 | Revisão jurídica: LGPD, contrato e política de privacidade | Antes da primeira venda |
| 13 | Procedimento de exclusão definitiva de empresa | Necessário antes do primeiro encerramento real |
| 14 | Manter Keycloak próprio ou usar provedor de identidade gerenciado | Custo × operação |
