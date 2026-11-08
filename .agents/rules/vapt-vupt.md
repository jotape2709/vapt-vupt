---
trigger: always_on
description: "Contexto e limites do Vapt-Vupt Next: identidade azul, multiempresa, segurança e continuidade."
---

Leia as instruções canônicas em `AGENTS.md`, o início em `docs/context/START_HERE.md` e o estado em `docs/context/PROJECT_STATE.md`. Antes da tarefa, rode `npm run context:search -- "descrição da tarefa"` e leia os fontes recuperados. Ao concluir, atualize o estado quando necessário e execute `npm run context:snapshot` e `npm run context:check`.

Se `AGENTS.md` já foi carregado pelo Antigravity, esta regra serve apenas como referência de entrada; não cria uma segunda política. Nenhuma regra concede permissão para publicar produção ou acessar credenciais.
