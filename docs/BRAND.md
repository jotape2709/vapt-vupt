# Identidade — VV em movimento

Direção: verde profundo, papel claro e amarelo-lima. Um produto operacional acolhedor, com hierarquia e vocabulário direto. Evita carrinho, raio, gradiente decorativo e estatísticas falsas.

Monograma formado por dois V de alturas e sobreposição distintas. Entregues public/brand/symbol.svg, symbol-mono.svg, symbol-reverse.svg e wordmark.svg. São vetores reais. O wordmark contém texto SVG com fallback de fonte; ainda não é arte-final tipográfica com letras convertidas em contornos. Símbolos usam paths e escalam sem dependência de fonte. Exploração visual gerada é estudo separado, não substitui os ativos.

| Tema demonstrativo | Identidade | Acento claro | Acento escuro |
|---|---|---|---|
| Mercado Aurora | Floresta, conforto | #174D3C | #C5DC9B |
| Adega Vértice | Vinho, modo escuro | #71354E | #E9BAD0 |
| Bar da Esquina | Terracota, compacto | #8D452D | #ECC29F |

Tipografia local: Trebuchet MS/Arial para direção humanista; system-ui para uso operacional. Sem fontes remotas essenciais. Personalidade editorial com Georgia somente nas áreas expressivas. Fonte proprietária customizada não está incluída.

Tokens de cor, superfície, texto, foco, alerta e espaçamento no CSS. Paletas controladas; cor livre fica adiada até haver validação automática de contraste e todos os estados. Espaçamento em múltiplos aproximados de 4 px, controles com mínimo 44 px, foco visível, reduced motion e HTML dialog nativo.

Acessibilidade: estrutura semântica, labels, status textuais, navegação por teclado e adaptação responsiva implementadas. Auditoria visual, leitores de tela e medição completa WCAG ainda pendentes. Não declarar certificação.

UX: prioridade de reposição antes de gráficos; ausência de informação aparece como estado vazio; compras/cotações/equipe exibem status planejado; sucesso local não diz sincronizado. Módulos ocultos organizam navegação, não implementam autorização.

## Acabamento (refino visual, 2026-11-08)

Tokens de identidade trancados em `:root` de apps/web/styles.css (`--vv-*`): floresta #174D3C, tinta #203B31, papel #F7F8F3, sálvia #E7EDDC/#E6EACF, lima #DAE65E/#E1ED8F, oliva #88A33C, cobre #BB753E; Trebuchet MS como fonte principal e Georgia itálica só nas áreas expressivas. O refino não cria cores novas: profundidade vem de opacidade, `color-mix` com o acento da empresa, sombras em camadas tingidas de verde e gradientes radiais ultrassutis da própria paleta.

Movimento: `cubic-bezier(.16,1,.3,1)` para entradas e `cubic-bezier(.22,1,.36,1)` para estados táteis; 140 ms (feedback), 240 ms (hover/elevação), 640 ms (entrada). Animações usam `backwards` para não bloquear estados de hover e são desligadas por `prefers-reduced-motion`. Texto operacional mínimo de 11 px; alvos de toque mínimos de 44 px.
