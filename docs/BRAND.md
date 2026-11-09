# Identidade — VV em movimento

Direção aprovada: azul Royal, Azul Marinho e Azul Atlântico, com superfícies frias claras. Um produto operacional acolhedor, com hierarquia e vocabulário direto. Evita carrinho, raio, gradiente decorativo e estatísticas falsas.

Monograma aprovado: direção 03 do estudo, VV em fitas contínuas e paralelas, com curvas nos encontros e duas superfícies azuis. Reconstruído em paths SVG reais. Entregues public/brand/symbol.svg, symbol-mono.svg, symbol-reverse.svg e wordmark.svg. São vetores reais. O wordmark contém texto SVG com fallback de fonte; ainda não é arte-final tipográfica com letras convertidas em contornos. Símbolos usam paths e escalam sem dependência de fonte. Exploração visual gerada é estudo separado, não substitui os ativos.

| Tema demonstrativo | Identidade | Acento claro | Acento escuro |
|---|---|---|---|
| Mercado Aurora | Azul Royal, conforto | #174CDE | #A8C6FF |
| Adega Vértice | Azul Marinho, modo escuro | #173C72 | #BBD3FA |
| Bar da Esquina | Azul Atlântico, compacto | #00639C | #A5DBFA |

Tipografia local: Trebuchet MS/Arial para direção humanista; system-ui para uso operacional. Sem fontes remotas essenciais. Personalidade editorial com Georgia somente nas áreas expressivas. Fonte proprietária customizada não está incluída.

Tokens de cor, superfície, texto, foco, alerta e espaçamento no CSS. Paletas controladas; cor livre fica adiada até haver validação automática de contraste e todos os estados. Espaçamento em múltiplos aproximados de 4 px, controles com mínimo 44 px, foco visível, reduced motion e HTML dialog nativo.

Acessibilidade: estrutura semântica, labels, status textuais, navegação por teclado e adaptação responsiva implementadas. Auditoria visual, leitores de tela e medição completa WCAG ainda pendentes. Não declarar certificação.

UX: prioridade de reposição antes de gráficos; ausência de informação aparece como estado vazio; compras/cotações/equipe exibem status planejado; sucesso local não diz sincronizado. Módulos ocultos organizam navegação, não implementam autorização.

## Acabamento (refino visual, 2026-11-08)

O acabamento do PR #8 foi preservado: superfícies, bento, tipografia, motion e hierarquia. Seus tokens foram atualizados para o pedido posterior do responsável: azul #174CDE, tinta #172B4D, papel #F4F7FC e variações frias. Verde, lima e cobre deixaram de ser a identidade. Cor âmbar permanece somente em alertas de estoque, com função semântica.

A marca passou ao desenho 03, em fitas contínuas, aplicado ao componente Mark e a symbol.svg, symbol-mono.svg, symbol-reverse.svg, wordmark.svg, wordmark-reverse.svg e favicon.svg. São vetores reais; o wordmark preserva texto SVG com fallback de fonte, portanto ainda não é lettering convertido em contornos. O favicon usa adaptação em fundo azul.

Paletas canônicas da demonstração: blue/navy/sky. O contrato v1 aceita também os aliases forest/wine/copper por compatibilidade; o carregamento converte os aliases sem apagar catálogo, saldos ou logotipos do cliente. A personalização não altera permissões.

Responsividade: hero em uma coluna até 980 px, título sem nowrap, cabeçalho adaptável, seletor de empresa em linha própria nos celulares estreitos, grids minmax(0,1fr), busca/tabelas com rolagem contida e diálogos/formulários ajustados a 320 px. Não se usa overflow escondido como correção do título. Testes cobrem 320, 360, 390, 768, 1024 e 1440 px, incluindo nomes longos, cores, marca, catálogo e diálogo.

Movimento: `cubic-bezier(.16,1,.3,1)` para entradas e `cubic-bezier(.22,1,.36,1)` para estados táteis; 140 ms (feedback), 240 ms (hover/elevação), 640 ms (entrada). Animações usam `backwards` para não bloquear estados de hover e são desligadas por `prefers-reduced-motion`. Texto operacional mínimo de 11 px; alvos de toque mínimos de 44 px.
