# Ciclo 01 — experiência operacional e trabalho compartilhado

## Estado e objetivo

Branch única deste ciclo: `next/product-cycle-01`. Base: `main` no commit `1d9fb996d7d41daf68026b7d57c0d60fbed37a0e`.
Em 08/11/2026 (São Paulo), os PRs #1 a #9 já estavam fechados e integrados. Este ciclo começa com documentação; nenhum código da aplicação foi alterado para abrir o PR.

Objetivo proposto para a próxima entrega: uma demonstração operacional coerente para um pequeno mercado, preservando a configuração para adegas e bares, pronta para uma avaliação de usabilidade. Não equivale a piloto com dados reais.

O README atual informa que UI demonstrativa e API ainda são separadas. Confirmar o estado no código antes de implementar. O relatório docs/review/BLUE-RESPONSIVE.md registra a validação da identidade azul. Não copiar código de branches antigas indiscriminadamente: podem conter trabalho ainda não integrado e decisões diferentes.

## Decisões estabelecidas

- Marca: terceira direção VV em fitas, em SVG; azul como identidade da plataforma.
- Preservar o acabamento visual já integrado do Claude e evoluir componentes existentes.
- Linguagem simples para pessoas que precisam operar um comércio, com prioridades, ações e estados claros.
- Uma base configurável por organização; personalização nunca concede permissões.
- Demonstrações identificadas; não inventar operações confirmadas, clientes, números ou sincronização.
- Preservar MIT, histórico e trabalho de outros colaboradores.
- Um único PR aberto para este ciclo. Não abrir PR por tarefa ou por commit.
- Sem merge na main ou deploy de produção sem instrução de João.

## Prioridades propostas

1. Fluxo principal: encontrar/cadastrar produto → registrar entrada ou saída → conferir saldo e histórico. Tornar organização/unidade e estado demonstrativo inequívocos.
2. Design system aplicado a esse fluxo: hierarquia, tipografia, espaçamento, densidade, estados, contrastes e navegação no celular. Exploração visual limitada, mantendo logo e azul.
3. Base reproduzível e documentação: verificar dependências, commit do lockfile validado, uso de npm ci se compatível, README baseado no código e resultados reais.
4. Após validar a experiência: conectar UI, identidade, organizações e API, com sessões seguras, persistência e testes de isolamento.
5. Depois da operação online confiável: PWA, intranet, política offline, idempotência, conflitos, TLS, backups e restauração.

Câmeras/OpenCV, IA de reposição, POS, compras/cotações reais, lotes e rastreabilidade avançada ficam fora da primeira entrega. Contratos podem ser previstos sem apresentar recursos como implementados.

## Primeiro lote de implementação para o Claude

- Ler instruções vigentes, README, docs de arquitetura/segurança/identidade e código atual.
- Auditar o fluxo operacional demonstrativo e registrar os problemas prioritários em docs/UX-CYCLE-01.md.
- Comparar duas pequenas variações de composição do mesmo fluxo em capturas ou prévias temporárias, sem criar duas aplicações ou outra identidade. Justificar uma escolha por legibilidade, velocidade de uso e consistência.
- Aplicar a direção escolhida à visão geral, estoque/produtos e formulário de movimentação. Usar componentes/tokens compartilhados; evitar acumular overrides de CSS.
- Tratar estados vazio, busca sem resultado, erro de validação, confirmação local e foco/retorno do modal. Não criar spinners ou estados de sincronização fictícios.
- Conferir as três empresas, claro/escuro, conteúdo longo, zoom de 200%, teclado e telas de 320 a 1440 px. A tabela pode rolar internamente, com indicação acessível.
- Consolidar dependências e corrigir instruções desatualizadas do README, após verificar o código e o histórico dos checks. Não reescrever fatos sem evidência.
- Executar lint, build e testes relevantes disponíveis. Testes ignorados/falhos não contam como aprovados. Não enfraquecer asserts para passar.
- Entregar commits pequenos, screenshots e resumo de funcionamento/limitações no mesmo PR. Parar ao concluir esse lote para revisão; não iniciar backend, offline ou integrações automaticamente.

## Protocolo entre assistentes

João transmite os prompts e os resultados. Não há comunicação direta presumida entre Claude e ChatGPT.

- Claude é o único escritor de código durante este lote.
- ChatGPT faz planejamento e revisão em modo leitura, salvo quando João transferir explicitamente a implementação.
- Antes de trabalhar: verificar branch, alterações locais, HEAD remoto e PR ativo; sincronizar sem sobrescrever trabalho.
- Antes do push: buscar novamente o HEAD remoto. Se houve avanço concorrente, inspecionar e integrar os commits com cuidado; não usar force-push ou reset destrutivo.
- Não criar outra branch remota ou PR por conveniência da ferramenta. Se o ambiente impuser isso ou não permitir escrever na branch combinada, informar a limitação antes de publicar em outro lugar.
- Atualizar a descrição do mesmo PR à medida que o escopo se concretizar. Não confundir backlog com funcionalidade entregue.
- Se o PR já estiver integrado ou fechado, comunicar a condição antes de criar outro.
- A limpeza de branches antigas só acontece depois de verificar commits ainda não integrados; o histórico de PRs fechados não precisa ser apagado.

## Registro de passagem

Atualizar este bloco ao final de cada lote:

- Responsável atual: Claude (após receber o prompt de João).
- Lote: experiência operacional demonstrativa e base reproduzível.
- Último commit de implementação deste ciclo: ainda não iniciado.
- Arquivos alterados: somente este documento na abertura do ciclo.
- Checks desta abertura: leitura do estado remoto e revisão documental; build/testes da aplicação não reexecutados para esta mudança apenas documental.
- Checks da implementação: registrar comando, resultado, falhas/ignorados e link do CI.
- Decisões e pendências: registrar antes de transferir a escrita para outro assistente.
- Próxima revisão: João + ChatGPT, a partir do SHA informado pelo Claude.

## Perguntas para validar com o estabelecimento

Antes de usar dados reais, confirmar: quem opera e em qual dispositivo; quantidade aproximada de produtos; uso de códigos de barras; unidades e fracionamentos; como chegam mercadorias; como saídas são registradas hoje; existência de caixa/POS; qualidade da rede e tolerância à indisponibilidade. Estas respostas definem o escopo do piloto seguro.
