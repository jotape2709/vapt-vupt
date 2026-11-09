# Ciclo 02 — primeira operação real de ponta a ponta

## Estado e objetivo

Branch única deste ciclo: `product/cycle-02`, criada a partir da `main` no commit `950ac128e53de854cacc3809d4bd0be2a126da7b` (merge do PR #10; commit revisado do ciclo 01: `4e08ff9058b9ef4058254a347d90b16fba55c16f`). Um único PR em rascunho recebe todos os commits deste lote. Sem merge, exclusão de branches, deploy ou serviços pagos.

Objetivo: autenticar → acessar empresa autorizada → configurar a identidade da empresa → cadastrar produto → registrar entrada/saída → consultar saldo e histórico persistidos, com API e PostgreSQL. Dados operacionais não dependem de localStorage.

Este documento é atualizado a cada lote. O registro de passagem fica no final.

## Escopo deste lote

1. Auditoria do frontend, API, migrations, autenticação e testes existentes.
2. Sessão de servidor com OIDC (Authorization Code + PKCE), cookies HttpOnly, CSRF, expiração, logout e invalidação.
3. Organizações, unidades, contexto autenticado e provisionamento administrativo auditado.
4. Configuração versionada por empresa (identidade, aparência, módulos, navegação, visão geral), preferências pessoais separadas, templates de mercado/adega/bar e logotipo validado no servidor.
5. Catálogo por organização e saldo por unidade, com paginação, busca, idempotência, concorrência e reconciliação.
6. UI real com estados de carregamento, erro, sessão expirada, acesso negado, conflito e confirmação do servidor; demonstração mantida como sandbox separada.
7. Matriz de permissões e testes com PostgreSQL real e papel restrito; testes de navegador do fluxo real.
8. Docker Compose de desenvolvimento com PostgreSQL e provedor OIDC real (Keycloak), documentação e limitações.

Fora do escopo: PWA, escrita offline, câmeras, IA de reposição, POS, fiscal, compras e cotações reais.

## Registro de passagem

### Lote 1 — em andamento (Claude, 09/11/2026)

- Responsável: Claude. Estado: **em implementação**.
