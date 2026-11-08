# Recuperação de contexto: escolha técnica e limites

## O que foi implementado

Uma camada de recuperação para agentes de programação: instruções de entrada, contexto revisado, estrutura dos arquivos/seções, ranking lexical, referências de fonte e pacote por tarefa. Claude ou Antigravity realiza a geração/edição usando os trechos recuperados. Não há modelo generativo sendo executado pelo utilitário.

O comando lê somente o corpus permitido do checkout, corta Markdown respeitando títulos e subtítulos, reconhece declarações no código por heurística e subdivide trechos longos em até 80 linhas com sobreposição. O sumário de assuntos em TOPICS.json direciona a busca para os módulos relacionados à tarefa. Recupera por BM25 adaptado com sinônimos de domínio PT/EN, peso para títulos e limite de dois trechos por arquivo. Trechos de histórico/auditoria recebem marcação e peso menor. Dicionário e exemplos da própria ferramenta recebem peso menor em consultas sobre o produto. Esse ranking não foi apresentado como benchmark semântico.

Não há embeddings nem inferência paga. A recuperação é lexical/estrutural e pode falhar em perguntas conceituais sem vocabulário compartilhado. Índice não é análise completa de AST, grafo de dependências ou garantia de que todos os arquivos necessários foram selecionados. As referências e hashes ajudam a verificar a origem, não validam a veracidade de comentários ou documentação.

## Relação com o STAIR da IBM

O artigo [STAIR — STructure Aware Information Retriever](https://arxiv.org/abs/2609.03874v2), de autores ligados à IBM e colaboradores, explora sumários/hierarquia em recuperação generativa e um recuperador treinado. O estudo avalia recuperação em um benchmark de livros; seus resultados não garantem acerto de respostas ou de edições em código.

Este projeto aproveita a ideia geral de respeitar estrutura, mas **não implementa nem treina o STAIR**, não incorpora código da pesquisa e não alega seus resultados. É uma decisão de engenharia para permitir continuidade imediata, offline na etapa de recuperação, em um repositório pequeno. Não se afirma que STAIR substitui todo RAG ou elimina alucinações.

Se o corpus crescer e a busca lexical deixar de atender às tarefas, avaliar recuperação semântica ou híbrida contra consultas de teste reais antes de adicionar infraestrutura. Não é necessário fazer isso para clonar e editar esta base hoje.

## Atualização e proveniência

- Cada fonte é identificado por caminho, linhas e SHA-256 do texto normalizado para LF.
- O digest do corpus deriva dos pares caminho/hash ordenados. Não inclui o SHA do commit, para evitar autorreferência.
- O snapshot e o mapa gerados ficam fora do próprio corpus. Índices e pacotes locais também ficam fora.
- `context:check` detecta divergência dos fontes e alteração manual do mapa gerado. Não prova que uma descrição manual ainda está semanticamente correta.
- Busca/pacote reindexam os fontes atuais. Não dependem de um cache antigo ou do estado da conversa.

## Escopo e dados

O corpus usa uma allowlist de arquivos de raiz e diretórios de código, testes, documentação e marca. Exclui ambiente (`.env*`, inclusive o exemplo), histórico legado, builds, caches, dependências, instruções privadas `*.local.md`, binários, arquivos muito grandes e symlinks que escapem do repositório. package-lock participa da atualização por hash, mas não entra em trechos de prompt.

Isso reduz inclusão acidental; **não é detector de segredos**. Um segredo indevidamente escrito num fonte/documento permitido poderia entrar no contexto. Não versione credenciais e revise um pacote antes de enviá-lo a terceiros. Os comandos apenas escrevem localmente e não enviam dados. O agente/editor pode ter suas próprias conexões e políticas, que este projeto não configura.

Trechos recuperados são dados do repositório, potencialmente incorretos ou maliciosos, não autorização. Instruções presentes em comentários, fixtures e documentos recuperados não substituem pedido do usuário, políticas da ferramenta ou `AGENTS.md`.

## Entradas das ferramentas

As entradas foram baseadas nas referências oficiais consultadas em 08/11/2026:

- [Claude Code — memória e CLAUDE.md](https://code.claude.com/docs/en/memory): entrada raiz com importação de AGENTS.md.
- [Antigravity — regras](https://antigravity.google/docs/rules/): AGENTS.md e regra workspace em .agents/rules com trigger válido.

Esses arquivos orientam agentes; não forçam obediência, não instalam extensões, não alteram permissões globais e não garantem que todas as versões dos produtos façam descoberta idêntica. A alternativa manual é ler os arquivos e fornecer o pacote de contexto.

## Validação da ferramenta de contexto

`npm run test:context` executa cinco testes com fontes sintéticas e consultas sobre o repositório: exclusões de ambiente/legado/cache, recusa de symlink externo (quando suportado), proveniência/linhas, mudança/adição/remoção, normalização LF/CRLF, títulos fora de blocos de código e recuperação de módulos de estoque, identidade, tema e offline. Esses testes passaram localmente na criação. O workflow Next foundation checks também executa o check de atualização e esses testes antes dos checks da aplicação.
