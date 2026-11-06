# Auditoria inicial — 6 de novembro de 2026

Base: commit `5e1729d5aa279b3935a8cece1302e050cdfcfb5e`. Inventário completo da árvore: LICENSE, README.md, index.html, vapt-vupt.html, css/styles.css, js/app.js, img/favicon.svg. Inspeção estática; nenhuma execução da versão antiga nem ensaio de exploração em produção.

| Arquivo original | Evidência / achado | Decisão |
|---|---|---|
| js/app.js:159–211 | SHA-256 simples no navegador; vv_user contém hash de senha e vv_session define usuário em localStorage; nenhuma autoridade de servidor | Não reutilizar autenticação. Demo nova não pede credenciais |
| js/app.js:826–859 | processUpload verifica extensão/tamanho, espera 1,8 s e sempre retorna 103 itens / 7 críticos / 12 atenção sem ler conteúdo | Remover importação fictícia; parsing real fica no roadmap |
| js/app.js:752,906,1322 | chooseOffer, saveConfig e recuperação de senha apenas mostram notificações | Não emitir essas confirmações na aplicação nova |
| js/app.js | Catálogo, fornecedores, preços, promoções e estoques embutidos; cotação não notifica parceiros | Identificar claramente dados demo; compras/cotações planejadas |
| vapt-vupt.html:2386–2388,2449 | Nome do arquivo e mensagens interpolados em innerHTML sem escape nessa versão | Arquivar; excluir do build. Não alegar que escapeHtml da outra versão corrige esta |
| index.html | Afirma 500+ estabelecimentos ativos, 73% menos rupturas, economia de 18%, criptografia e conformidade total sem evidência | Substituir textos comerciais por apresentação factual |
| README.md | Status concluído, LGPD Compliant e proteção total; afirma upload XLSX, cotações reais e estatísticas sem implementação/evidência | Reescrever integralmente |
| css/styles.css:20 | outline:none em controles; ações em spans/divs com onclick; modais sem foco gerenciado; sem regra de movimento reduzido | Controles nativos, foco visível, dialog e prefers-reduced-motion |
| index.html / css | Há breakpoints, mas navegação desaparece em telas pequenas; não houve ensaio visual em dispositivos | Nova navegação móvel rolável, alvos de toque; validar visualmente ainda |
| index.html / vapt-vupt.html | Dependência de Google Fonts; HTML monolítico e duplicado, JS global | Recursos essenciais locais; Vite + módulos React/TypeScript |
| img/favicon.svg | SVG de 9476 bytes com texto e desenho em área 1080×1080, inadequado como símbolo legível em tamanho pequeno | Monograma VV simplificado em SVG real |
| LICENSE | MIT, Copyright (c) 2026 João Pedro | Preservar integralmente e manter atribuição |

## Organização e desempenho

Não havia package.json, build, testes, API, banco, migrations, PWA ou contratos de domínio. index.html tem 1375 linhas; vapt-vupt.html, 2495; js/app.js, 1381. As duas implementações divergem. Valores CSS e vocabulário do catálogo podem orientar o produto, mas o runtime antigo não deve servir de base de autorização.

A meta X-Content-Type-Options no HTML não substitui o header HTTP. Não foi encontrada configuração de headers de servidor no repositório; infraestrutura externa não foi auditada. Não há base para garantir conformidade LGPD ou ausência de XSS.

## Reaproveitamento

Preservados: nome, propósito de reposição, vocabulário de produtos/unidades, origem e licença. Catálogo original tem foco também em farmácia; a nova demo limita-se a mercado, adega e bar, sem alegar adequação a operação regulada.

O código original é preservado em legacy/ e no histórico Git. Esse diretório não integra dist/. Não servir a raiz do repositório como instalação de produção.

## Limites da auditoria

Arquivos recuperados pelo conector GitHub. Revisão estática orientada por evidências; não é pentest, certificação, auditoria legal nem validação completa de acessibilidade. A imagem vetorial original foi inspecionada como fonte, sem renderização nesta sessão.
