# Continue o projeto com Claude ou Antigravity

Este diretório é o contexto portátil do Vapt-Vupt Next. O repositório inclui instruções, estado revisado, backlog, mapa de fontes, recuperação local e verificação de atualização. Não exige assinatura adicional de API, servidor vetorial ou acesso ao histórico desta conversa.

## Clone a branch com a reconstrução

```bash
git clone --branch next/foundation-product --single-branch https://github.com/jotape2709/vapt-vupt.git
cd vapt-vupt
npm ci
npm run context:check
```

A branch `main` contém a versão anterior até ocorrer um merge autorizado. Não clone a principal esperando encontrar a reconstrução.

## Abra com o agente

**Claude Code:** abra a pasta do repositório. `CLAUDE.md` importa `AGENTS.md`, que aponta para o estado, fontes e comandos. Não precisa instalar extensão deste projeto, colocar token no Git ou usar a API Anthropic nos scripts de contexto.

**Antigravity:** abra a raiz do repositório como workspace. Há `AGENTS.md` na raiz e `.agents/rules/vapt-vupt.md` com `trigger: always_on`. A descoberta das regras depende da versão/configuração da ferramenta; se não aparecerem, peça explicitamente para ler `AGENTS.md` e este arquivo. Não altere suas políticas globais ou permissões para isso.

**Claude Chat/Projects:** a entrada automática acima é específica de ferramentas com workspace. No chat, forneça acesso aos arquivos ou anexe `AGENTS.md`, `PROJECT_STATE.md`, `NEXT_TASKS.md` e o pacote gerado da tarefa. Um chat sem terminal não executará os comandos por ler estas instruções.

## Monte o contexto da tarefa

```bash
npm run context:search -- "autenticação OIDC e isolamento por empresa"
npm run context:pack -- "autenticação OIDC e isolamento por empresa"
```

A busca imprime trechos atuais com arquivo, linha, seção, hash e score. O pacote fica em `.context/context-pack.md`, ignorado pelo Git. Leia ou forneça esse arquivo ao agente. A geração da resposta e a edição ficam a cargo do Claude/Antigravity, que deve conferir os fontes completos e testar a mudança.

Outros exemplos:

```bash
npm run context:search -- "tema azul personalização"
npm run context:pack -- "replay idempotência expectedVersion saldo"
npm run context:search -- "offline PWA intranet"
npm run context:index
```

`context:index` exporta `.context/index.json` para inspeção/integração local. A busca e o pacote sempre reconstroem seu índice em memória a partir dos fontes atuais; não reutilizam esse arquivo como verdade. Os scripts não chamam modelo, embedding ou serviço externo.

## Primeiro pedido sugerido ao agente

> Leia AGENTS.md, docs/context/PROJECT_STATE.md e docs/context/NEXT_TASKS.md. Confira a branch e rode npm run context:check. Recupere contexto para a tarefa que vou informar e leia os fontes relevantes antes de editar. Preserve a identidade azul e os limites de segurança. Implemente a alteração, valide com checks proporcionais e documente o que ficou pendente. Não publique produção nem faça merge na main sem meu pedido. Minha tarefa é: [descreva aqui a mudança].

## Atualização durante o trabalho

```bash
# Após mudar o comportamento, revise primeiro PROJECT_STATE.md e os guias afetados.
npm run context:snapshot
npm run context:check
npm run test:context
```

Versione `SOURCE_SNAPSHOT.json` e `REPOSITORY_MAP.md` junto da alteração. O check compara conteúdo normalizado para LF, não o SHA do commit: funciona em clones Windows com CRLF e não exige regravar o contexto só porque um commit novo foi criado.

O snapshot detecta mudanças, adições e remoções no corpus permitido, mas não escreve sozinho a explicação do produto. Um agente pode atualizar hashes e ainda deixar um texto factual errado; por isso, revisão do estado e leitura dos fontes continuam necessárias.

## O que ler em seguida

| Preciso entender | Arquivo |
|---|---|
| O que funciona e o que falta | [PROJECT_STATE.md](PROJECT_STATE.md) |
| Por onde continuar | [NEXT_TASKS.md](NEXT_TASKS.md) |
| Assuntos e fontes preferenciais | [TOPICS.json](TOPICS.json) |
| Onde ficam os fontes | [REPOSITORY_MAP.md](REPOSITORY_MAP.md) |
| Decisões de arquitetura | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Provedor real, API e banco | [CONNECTED_ACCESS.md](../CONNECTED_ACCESS.md) |
| Segurança e limites | [SECURITY.md](../SECURITY.md) |
| Identidade azul | [BRAND.md](../BRAND.md) |
| Resultados de testes anteriores | [VALIDATION.md](../VALIDATION.md) |
| Método de recuperação e relação com STAIR | [RETRIEVAL_DESIGN.md](RETRIEVAL_DESIGN.md) |
