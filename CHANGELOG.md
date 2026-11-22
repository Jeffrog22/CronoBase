# Changelog - CronoBase

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]
### Added
- (novas funcionalidades)

### Changed
- (mudanças em funcionalidades existentes)

### Fixed
- (correções de bugs)

### Removed
- (funcionalidades removidas)

## [v0.2.1] - 22/11/2026
### Added
- E2E: check "modal cobre a viewport" via `getBoundingClientRect` — pega
  regressão de modal `open` mas inline/parcial

### Changed
- CSS mobile-first: o gap fixo de ~5cm entre Iniciar/Parar virou enhancer
  `@media (min-width: 641px)` — a base (mobile) usa larguras iguais
- `flex-wrap: wrap` em `.field-row` e `.summary-item-head` (rows empilham
  em telas estreitas)
- `--touch` de 48px para 56px (PRD recomenda alvos ≥56px)
- Relógios mestre/contínuo com `clamp()` — escalam com a largura da tela
  (2.6–3.5rem e 1.7–2.5rem) em vez de tamanho fixo

### Fixed
- Modal do cronômetro não abria/sobrepor em máquinas com SW antigo: cache
  híbrido do Service Worker (HTML novo + JS/CSS antigos, `VERSION` sem bump
  desde v0.1.0) — `sw.js` vai para `cronobase-v2` e **todos** os assets
  same-origin passam a `networkFirst` (rede primeiro, cache só offline)
- Atributo `hidden` não escondia elementos com `display` declarado pelo autor
  (neste Edge o UA `[hidden]` não usa `!important`): telas config/resumo,
  update-banner e toast ficavam empilhados no body — gerava scrollbar de
  15px e modal com largura parcial — corrigido com
  `[hidden] { display: none !important }` em `styles/app.css`
- `registerSW` passa `updateViaCache: "none"` — o navegador revalida `sw.js`
  a cada navegação mesmo com HTTP cache (essencial no `python http.server`,
  que não envia `Cache-Control: no-cache`)

## [v0.2.0] - 22/11/2026
### Added
- Cronômetro abre como `<dialog>` modal colado ao topo da viewport (largura
  total) em vez de seção estática — ao iniciar/reabrir treino a tela já nasce
  no topo (`scrollTo(0,0)` + `showModal()`)
- Linha de controles (`Iniciar · Parar · Zerar · Resumo`) como primeira linha
  do modal, colada na borda superior e centralizada, com gap fixo de ~5 cm
  entre Iniciar e Parar (telas ≤ 640px voltam ao layout de larguras iguais)
- Esc no modal do cronômetro pede confirmação de sair (mesmo fluxo do botão
  Sair) em vez de fechar direto e descartar a sessão

### Changed
- Safe-area-inset-top migrou do cabeçalho do cronômetro para a linha de
  controles (que agora é o primeiro elemento do modal)
- Toast move para dentro do dialog enquanto o cronômetro está aberto —
  senão ficaria atrás do backdrop (top layer) e sumiria durante a sessão

### Removed
- Atributo `hidden` da tela do cronômetro (substituído por `open` do `<dialog>`)

## [v0.1.0] - 20/11/2026
### Added
- App PWA estático completo (Modo 2) — sem backend, sem build step
- Motor do Modo 2 (`js/modo2.js`): mestre contínuo, parciais, seleção
  round-robin, descanso/intervalo wall-clock, liberação sincronizada ≤10 s,
  rollover de séries e conclusão de grupo
- Configuração de sessão em 3 passos (nome, estilo, distância, repetições,
  descanso, séries, intervalo) com cadastro rápido de atletas
- Resumo com Salvar (localStorage, até 50 sessões), Descartar e Exportar JSON
- Adaptador GameSir X5 Lite (edge, debounce 200 ms, priming, detecção de
  desconexão) com tabela de mapeamento na Ajuda
- Três temas (Normal, Noturna, Beira de piscina) persistidos e trocáveis
  durante a sessão sem alterar o estado dela
- PWA: `manifest.webmanifest`, service worker com cache offline e atualização
  sem reload forçado durante sessão não salva, ícones 192/512/maskable
- Testes permanentes: `tests/logic.mjs` (motor, Node) e
  `tests/e2e-runner.mjs` (fluxo completo em navegador headless) — `npm test`
- Documentação: README, guia de deploy Cloudflare Pages, PRD, DEVELOPMENT,
  AGENTS.md e este CHANGELOG
- Hook SemVer automático (`.githooks/post-commit`)

### Fixed
- Corrida no diálogo de confirmação: evento `close` atrasado de uma sessão
  anterior resolvia/fechava a nova sessão de confirmação (Zerar, Salvar e
  Descartar) — corrigido com contador de fechamentos intencionais em `js/ui.js`
