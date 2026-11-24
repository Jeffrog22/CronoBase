<!-- última-sessão: 23/11/2026 — Tema Solar (alto contraste), id pool mantido, sw v6, versão 0.11.0 -->
# AGENTS.md — Histórico Completo do Projeto

## Regras de Ouro

- **Report style**: ao finalizar, responder com `Done.` + bullets do que foi feito + `commit hash + tag → destino` (nunca omitir bullets).
  Ex:
  ```
  Done.
  - Corrige A
  - Adiciona B
  `abc123 + v1.9.20 → origin/master`
  ```
- **AGENTS.md é o único histórico**: SESSION.md não existe mais. Toda sessão registrada aqui.
- **Commits + Push**: ao receber "done" (ou "anote ai! done", "done + commit tag destino", etc), executar automaticamente o ciclo completo: `git add -A → git commit -m "..." → git push origin master && git push origin <tag>`. Sempre. Sem perguntar. **Nunca perguntar se deve push** — fazer sempre.

## Versionamento Semântico (SemVer 2.0.0)

O post-commit hook (.githooks/post-commit) detecta automaticamente o bump baseado na mensagem do commit (Conventional Commits):

| Mensagem do commit | Bump | Exemplo |
|---|---|---|
| `BREAKING CHANGE` no body ou `!:` no subject | **MAJOR** (vX.0.0) | `feat!: remove deprecated endpoint` |
| `feat:` no subject | **MINOR** (v0.X.0) | `feat: add new feature` |
| `fix:`, `refactor:`, `chore:`, `docs:`, etc | **PATCH** (v0.0.X) | `fix: corrige calculo` |

Regras:
- **MAJOR**: mudança incompatível na API ou no banco (breaking change)
- **MINOR**: adição de funcionalidade retrocompatível
- **PATCH**: correção de bugs e pequenas melhorias
- O hook usa `git log -1` para ler a mensagem do commit recém-criado
- Tags conflitantes (orphan) são puladas automaticamente (loop `while` incrementa PATCH)

## Identidade
- **Nome:** CronoBase
- **Descrição:** Cronômetro de treino PWA (Modo 2) da Fizapp, com controle GameSir X5 Lite e três temas
- **Repositório:** `https://github.com/Jeffrog22/CronoBase.git`
- **Versão atual:** v0.11.0
- **Stack:** JavaScript ES modules puro (sem framework, sem build step), HTML5 + CSS3 (design tokens), PWA (manifest + service worker). Persistência: `localStorage`. **Não existe backend.**
- **Deploy:** Cloudflare Pages (estático) — guia em `docs/DEPLOY-CLOUDFLARE.md`
- **Testes:** `npm test` = `tests/logic.mjs` (motor em Node) + `tests/e2e-runner.mjs` (navegador headless)
- **Ferramenta de IA:** opencode (lê este arquivo automaticamente)

---

## Sumário de Arquivos Relevantes

| Arquivo | Função |
|---------|--------|
| `index.html` | App de página única — 3 telas (config, cronômetro, resumo) + diálogos |
| `js/motor` → `js/modo2.js` | Regras do Modo 2 (lógica pura, testável em Node) |
| `js/drum.js` | Drums/slot machines do passo 2 (scroll-snap + teclado) — v0.10.0 |
| `js/xlsx.js` | Gerador .xlsx puro (crc32 + ZIP store + OOXML) — v0.9.0 |
| `js/state.js` | Estado singleton da sessão, `DEFAULT_CONFIG`, `uid` |
| `js/ui.js` | Camada de renderização (única que toca o DOM de dados) + `showScreen` (abre/fecha o `<dialog>` do cronômetro) |
| `js/main.js` | Bootstrap, handlers de eventos, PWA |
| `js/store.js` | Persistência localStorage (semântica transacional) |
| `js/gamepad.js` | Adaptador GameSir X5 Lite (edge/debounce/priming) |
| `js/themes.js` / `js/wake.js` / `js/clock.js` | Temas, wake lock/vibração, relógio |
| `styles/tokens.css` / `styles/app.css` | Design tokens + 3 temas; layout/responsivo |
| `tests/logic.mjs` | Testes do motor (Node, sem DOM) |
| `tests/e2e-checks.js` + `tests/e2e-runner.mjs` | Fluxo completo em navegador headless |
| `sw.js` / `manifest.webmanifest` / `_headers` | PWA: cache offline, manifest, headers Cloudflare |
| `PRD-CronoBase.md` | Requisitos e 11 critérios de aceite |
| `DEVELOPMENT.md` | Convenções de commit, versionamento, rotina de sessões |
| `CHANGELOG.md` / `AGENTS.md` | Versões / histórico completo do projeto |
| `docs/DEPLOY-CLOUDFLARE.md` | Guia de deploy no Cloudflare Pages |

---

## Contexto Crítico (Conhecimento Adquirido)

- **Sem backend, sem banco, sem build.** O app é HTML/CSS/JS puro servido estático; dados vivem no `localStorage` (`cronobase.sessions.v1`, `cronobase.atletas.v1`, `cronobase.config.v1`, `cronobase.theme`, `cronobase.sound.v1`). Nunca proponha API, React ou PostgreSQL — o PRD manda ser independente e local.
- **`js/modo2.js` é lógica pura** (sem DOM): recebe `state` e `Date.now()`, retorna eventos. É o que `tests/logic.mjs` cobre. `js/ui.js` é a única camada que toca o DOM de dados (usa `textContent`, nunca `innerHTML` com valores do usuário).
- **Corrida clássica no diálogo de confirmação (corrigida em v0.1.0):** o evento `close` de um `dialog.close()` pode ser processado com atraso (task queue). Antes da correção, um `close` atrasado do Zerar resolvia/fechava a sessão de confirmação do Salvar — sintoma: `confirmDialog.open=false` logo após abrir, sem nenhum erro no console. A correção usa um contador `expectedCloses` em `js/ui.js` que consome fechamentos intencionais. **Não remover esse contador.**
- **Regra do motor:** distância < 50 m nunca registra split; descanso usa wall-clock (`waitEndsAt`), não decremento fixo; quando faltam ≤10 s para um descanso e outro está vencido, ambos liberam juntos ("Aguardando…" congela a raia vencida); seleção automática é round-robin só entre raias ativas (não concluídas/descansando).
- **Service Worker nunca ativa versão sozinha** (sem `skipWaiting` automático): atualização só via banner + confirmação, e bloqueada se houver sessão não salva. `/sw.js` precisa de `Cache-Control: no-cache` (já em `_headers`).
- **Cache do SW (lição v0.2.1):** toda release que mudar JS/CSS/HTML **deve bumpar `VERSION` do `sw.js`** (senão o navegador nem detecta a atualização) — mas o plano de rede é `networkFirst` para **todos** os assets same-origin (nunca `cacheFirst`): quem está online sempre recebe código atual, cache só serve de fallback offline. Isso evita o cache híbrido (HTML novo + JS/CSS antigos) que deixou o modal "não abrir". `registerSW` usa `{ updateViaCache: "none" }` para revalidar `sw.js` mesmo com HTTP cache.
- **`[hidden]` precisa de regra autor:** neste Edge o UA `[hidden]` **não** usa `!important`, então `.screen { display: flex }` (autor) vencia o `hidden` — telas config/resumo, update-banner e toast ficavam empilhados (bodyScroll + scrollbar de 15px comendo largura do modal). `styles/app.css` tem `[hidden] { display: none !important }` — **não remover**. E2E valida com o check "modal cobre a viewport".
- **Testes E2E rodam em navegador headless** com `--dump-dom` e `--virtual-time-budget`; o runner precisa de `spawn` **assíncrono** (spawnSync bloqueia o event loop e o servidor HTTP local morre de fome — o Edge trava até o timeout).
- **`npm run check`** = sintaxe (`node --check`) de todos os módulos; **`npm test`** = lógica + E2E. Ambos verdes antes de qualquer commit.
- **O cronômetro é um `<dialog>` modal (`#screen-chrono`)**, não mais `<section hidden>`: abre via `showModal()` em `showScreen()` (js/ui.js), fecha via `close()`, e usa atributo `open` (não `hidden`). `Esc` dispara `cancel` → `preventDefault` → `exitChrono` (confirmação obrigatória). O `#toast` é movido para dentro do dialog enquanto aberto (top layer fica acima de qualquer `z-index` do body) e devolvido ao `<body>` ao sair. **Não usar `hidden` nesse elemento.**
- **Linha de controles no topo do modal**: `.chrono-controls` é o 1º filho de `#screen-chrono` (`position:relative` — ancora o `#kebabPanel`), com 3 zonas: `#summaryBtn` (cinza) à esquerda · `.controls-center` = **palco** `Iniciar · Sessão contínua · Parar` (`flex: 1 1 min-content`, `gap: 0.5rem`; basis min-content faz o trio parear com o Resumo na linha 1 e só o grupo da direita quebrar — basis 0 estourava a pílula em ~490px, basis auto deixava o Resumo sozinho em ~430px; ≤400px retrato comprime fontes/padding p/ manter 2 linhas) · `.controls-right` = pílula GameSir + kebab. **O gap de 5cm da v0.2.1 foi REMOVIDO em v0.8.0** (pedido do usuário — a Sessão contínua passou a ocupar o meio); `margin-right` do `#startBtn` não existe mais. Safe-area-inset-top está no `.chrono-controls`. O palco é o que o drag&drop de posição livre usa (`.controls-center.free` com `align-self: stretch`).
- **Zerar é long-press do Parar (v0.3.0)** — não existe `#resetBtn`. Segurar `stopBtn` ≥3s (`STOP_HOLD_MS` em ui.js) emite `reset` (confirmação); soltar antes = tap normal (`stopLongFired` engole o click subsequente). Gamepad RT espelha o padrão do Home (`GP_ZERAR_LONG_MS`): tap = parar, hold ≥3s = zerar. Parar pausado fica habilitado quando há dados (`hasData`); toque pausado → toast "Já pausado.". **Não remover `expectedCloses` nem o swallow do longFired.**
- **Grid de paisagem (v0.3.0, ordem v0.3.1, áreas v0.7.0)**: `@media (orientation: landscape) and (max-height: 560px)` usa áreas `"controls"` → `"header"` → `"list list"` (state-line oculta e rodapé removido desde v0.7.0 — a altura toda vai para as raias, **4 cards sem scroll**) — **nunca colocar `"header"` como 1ª linha** (v0.3.0 empurrava os botões para o meio da tela). `.chrono-controls` é **rente ao topo**: `padding-top: env(safe-area-inset-top)` (sem respiro de 0.55rem; o safe-area só afasta de notch/status bar em retrato PWA). Raias em modo compacto (1 linha, `.raia-temps` escondido). `.raia-clock` tem cap `min(var(--clock-size), 1.7rem)` (1.05rem no paisagem) + `overflow-x: hidden` na lista (sem isso o `00:00:00` criava scrollbar horizontal em tela larga).
- **Kebab em 3 telas com `data-action` (v0.9.0)**: wrappers `.kebab` (position:relative) em config (`kebabBtnCfg`), resumo (`kebabBtnSum`) e cronômetro (`kebabBtn`); painel horizontal de 4 itens só-ícone 48px (`sound|help|export|clear`). Dispatch por delegação em `document` (fecha todos os kebabs, emite `soundToggle`/`openHelp`/`openExport`/`clearChoices`); Esc em capture fecha só o menu (nunca chega no `cancel` do `<dialog>`). `setSoundOn` itera `[data-action="sound"]`. **Não re-adicionar `#helpBtn`/`#helpBtnSummary`/`#exportBtn`/`#clearHistoryBtn`** — rodapé da config foi removido.
- **Alinhamento dos cronômetros (v0.9.0)**: `alignDisplays()` em `js/ui.js` escolhe `s` do palco em `[max(-roomL, tMin+δ), min(roomR, tMax+δ)]` e `t = s −δ` — clamp só do mestre *depois* de escolher `s = δ/2` quebrava a centrização (Δ=21.6px no E2E). Mede com transforms zerados; gatilhos: fim de `showScreen("chrono")` + `ResizeObserver` (transform não dispara RO → sem loop).
- **Exportação .xlsx (v0.9.0)**: `js/xlsx.js` é ZIP **store** (método 0) + OOXML mínimo, sem deps; `buildXlsx(sessions)` → `Uint8Array`; `store.downloadXlsx` faz Blob+`<a download>`. Modal `#exportDialog` lista sessões; ✕ por linha → `confirmAction` → `store.deleteSession` (histórico local); `savedCount` só existe no cabeçalho desse modal. JSON **não** é mais opção de export.
- **`clearChoices` só na config (v0.9.0)**: fora de `state.screen === "config"` emite toast e não altera nada; limpa `config → DEFAULT_CONFIG`, `selectedAtletas = []`, `step = 1`, input `novoAtleta` — **não** toca em `state.atletas` (registro) nem no histórico.
- **Config 100dvh (v0.9.0)**: `#screen-config { height:100dvh; overflow:hidden }` e só `.config-main` rola (`min-height:0; overflow-y:auto`); o rodapé sticky (6rem) foi removido. E2E valida `documentElement.scrollHeight ≤ innerHeight`.
- **Drums do passo 2 (v0.10.0)**: `js/drum.js` cria 4 wheels `scroll-snap` sobre `<input type="hidden">` com os **mesmos ids antigos** (`cfgRepeticoes`/`cfgDescanso`/`cfgSeries`/`cfgIntervalo`) — `syncConfigFromInputs`, listeners de `change` e `renderConfig` (que chama `syncDrums()`) não mudaram de contrato. **`ITEM_H = 40` em drum.js precisa bater com a altura de `.drum-item`/padding/banda no CSS** (assimetria: `clientHeight` do scroll é 118 por causa da borda do `.drum` → o snap do browser para em `i*40+1`; o E2E mede o centramento por retângulos, não por `scrollTop`). Commits de scroll **só após interação real** (`pointerdown`/`wheel` + janela idle de 300ms renovada a cada scroll) — sem isso, artefatos de layout/snap disparavam `change` e corrompiam `state.config` no meio do treino (matava o descanso do E2E). Grade garantida por `snapConfig`/`CONFIG_GRIDS` (state.js): reps/séries passo 1 (1 = "única"), descanso/intervalo múltiplos de 10, aplicado no load e no sync — `DEFAULT_CONFIG` (30/60) já está na grade. **Não re-tornar esses campos `<input type=number>`.**
- **Select de tema compacto + topbar 52px (v0.10.0)**: regra por **id** (`#themeSelect, #themeSelectChrono, #themeSelectSummary`) vence `.select`/`.select-sm`/`.chrono-header .select-sm` → fonte `.72rem`, altura 34px, largura auto; `option { font-size: .95rem/.85rem }` explícito mantém o **popup** nativo no tamanho de antes (no desktop Chromium o dropdown herda a fonte do select). Topbar: padding `.35rem` + `.topbar .kebab-btn` 40px (vence pool `56px` por especificidade `0,2,0`) → **topbar de 75px → 52px**; itens do painel do kebab seguem 48px. Kebab do ⋮ abaixo dos 56px do PRD é escolha do usuário. `alignDisplays()` usa o rect do select do cronômetro — encolher só afrouxa o clamp (Δ=0.0 no E2E).

---

## Sessão: 20/11/2026 — Início do Projeto

### O que foi feito
- Projeto iniciado a partir do kit de documentação replicável
- Estrutura de pastas e documentação base criadas

### Decisões
- ...

### Arquivos
- `CHANGELOG.md` (v0.1.0)
- `AGENTS.md` (esta sessão)

### Typecheck
- Frontend: 0 erros
- Backend: inexistente (app estático)

---

## Sessão: 21/11/2026 — Validação E2E, testes permanentes e liberação v0.1.0

### O que foi feito
- Corrige corrida no dialog de confirmação (evento close atrasado fechava a sessão do Salvar) via contador expectedCloses em js/ui.js — E2E 30/30 PASS
- Promove testes para tests/: logic.mjs (motor, Node), e2e-checks.js + e2e-runner.mjs (servidor Node + Edge headless autocontido); scripts npm test:logic/test:e2e/test
- Corrige runner E2E: spawnSync bloqueava o event loop e travava o Edge — trocado por spawn assíncrono
- Valida npm run check (11 módulos) e mapeia os 11 criterios de aceite do PRD
- Cria README.md do app, docs/DEPLOY-CLOUDFLARE.md e reescreve CHANGELOG v0.1.0
- Corrige AGENTS.md: stack real (sem backend), sumario de arquivos real e Contexto Critico com as licoes da sessao

### Decisões
- Testes viram ativo permanente em tests/ em vez de descartar o smoke (decisao do usuario)
- Commit unico feat: para gerar tag v0.1.0 alinhada ao CHANGELOG
- Nada de backend/React/PostgreSQL — PRD manda app independente e local

### Arquivos
- `js/ui.js`
- `tests/logic.mjs`
- `tests/e2e-checks.js`
- `tests/e2e-runner.mjs`
- `package.json`
- `README.md`
- `docs/DEPLOY-CLOUDFLARE.md`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 29/29 E2E — verde
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Cronômetro como modal colado ao topo (v0.2.0)

### O que foi feito
- Converte `#screen-chrono` de `<section hidden>` para `<dialog>` modal de borda total colado no topo (`margin: 0 auto`, `100dvh`, sem border-radius)
- Move `.chrono-controls` para o 1º filho do modal — linha de botões colada na borda superior, centralizada, com gap fixo de ~5cm entre Iniciar e Parar (`margin-right: calc(5cm - 0.5rem)`); media query ≤ 640px volta ao layout de larguras iguais
- `showScreen("chrono")` passa a usar `showModal()` + `scrollTo(0,0)`; sair usa `close()`; `#toast` entra/sai do dialog (top layer)
- Esc no modal → `cancel` com `preventDefault` → `exitChrono` (confirmação de sair, nunca fecha direto); registra `ui.on("exitChrono")` em main.js
- Migra safe-area-inset-top do `.chrono-header` para `.chrono-controls`
- Atualiza E2E: `$("screen-chrono").open` no lugar de `.hidden` (2 checks)
- CHANGELOG v0.2.0 + este registro

### Decisões
- Modal `<dialog>` em vez de reordenar a seção (escolha do usuário) — confirmação via diálogo empilhado funciona nativamente
- Gap 5cm literal com fallback ≤ 640px (pergunta pendente respondida com "ok" — manteve a guarda)
- Toast reparentado em vez de CSS z-index (top layer ignora z-index do body)

### Arquivos
- `index.html`
- `styles/app.css`
- `js/ui.js`
- `js/main.js`
- `tests/e2e-checks.js`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 29/29 E2E — verde
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Fix do modal (cache SW + [hidden]) + CSS mobile-first (v0.2.1)

### O que foi feito
- **Diagnóstico do bug "modal não apareceu/não sobrepos"**: SW antigo em `localhost:8080` com `cacheFirst` em JS/CSS → HTML novo (`<dialog>`) + `ui.js` antigo (nunca chama `showModal`) + CSS antigo → dialog inline sem backdrop. Causa raiz dupla confirmada por probe headless: (1) `sw.js` sem bump de `VERSION` desde v0.1.0; (2) UA `[hidden]` deste Edge não usa `!important` → `.screen{display:flex}` mantinha config (765px) + summary (488px) + update-banner empilhados → bodyScroll 1253 → scrollbar 15px → modal com 741 de 756px
- `sw.js`: `VERSION` → `cronobase-v2`; remove `cacheFirst`; **todos** os assets same-origin usam `networkFirst` (rede primeiro, cache offline)
- `js/main.js`: `register("sw.js", { updateViaCache: "none" })` — revalida sw.js mesmo com HTTP cache do `python http.server`
- `styles/app.css`: regra autor `[hidden] { display: none !important }`; inverte a MQ do gap 5cm (base mobile `flex:1 1 0` + `margin-right:0`, `@media (min-width: 641px)` aplica o gap); `flex-wrap: wrap` em `.field-row` e `.summary-item-head`
- `styles/tokens.css`: `--touch` 48→56px (PRD ≥56px); `--master-size`/`--clock-size` com `clamp()` (2.6–3.5rem / 1.7–2.5rem); pool mantém fixos
- E2E: novo check "modal cobre a viewport" (`getBoundingClientRect` vs `innerWidth/innerHeight`) — pega regressão de modal open mas inline/parcial
- CHANGELOG v0.2.1 + este registro

### Decisões
- `networkFirst` global em vez de só bumpar VERSION: app pequeno, online = sempre código atual, VERSION ainda bumpado para o banner/limpeza de cache
- Correção do `[hidden]` entrou no mesmo commit (pré-existente desde v0.1.0, mascarado porque o E2E só checava propriedades, não visibilidade)
- Gap 5cm mantido como enhancer `min-width: 641px` (mesmo breakpoint, metodologia invertida — zero mudança de comportamento)

### Arquivos
- `sw.js`
- `js/main.js`
- `styles/app.css`
- `styles/tokens.css`
- `tests/e2e-checks.js`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 30/30 E2E — verde (modal 756x488 = viewport exata, bodyScroll 488)
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Zerar via long-press + fix do modal em paisagem (v0.3.0)

### O que foi feito
- **Diagnóstico via print do usuário** (`print.jpeg`, gitignored): em paisagem o modal desconfigurava — linha de raia com relógio gigante sobrepondo + scrollbar horizontal, metade direita vazia (só hint), select de tema enorme, meta quebrando
- **Zerar = segurar Parar ≥3s**: removido `#resetBtn` (barra: Iniciar · Parar · Resumo); `stopBtn` com pointerdown/up/leave + timer 3s + classe `holding` (fill CSS 3s) + `haptic(60)`; `stopLongFired` engole o click; teclado Enter/Space espelha; `disabled` passa a `!masterRunning && hasData`; toque pausado → toast "Já pausado."
- **Gamepad RT**: `GP_ZERAR_LONG_MS = 3000` com padrão edge/hold do Home (`rtStart`/`rtFired`, reset na desconexão) — tap = "parar", hold ≥3s = "zerar" (`case "zerar"` → `handleReset`); `GP_MAP` atualizado
- **Paisagem**: grid `"list list"`/`"hint hint"` (lista full-width, hint linha própria); `.raia-clock` cap 1.7rem + nowrap; `.raia-list { overflow-x: hidden }`; badge "✓ selecionado" → "✓" ≤640px; `.chrono-header-actions .select-sm` limitado a 8.5rem/0.85rem
- Hint e help documentam o long-press; E2E: fluxo do hold (confirmação + click engolido + cancel mantém split), Parar pausado habilitado, "raias sem overflow horizontal"
- Validação visual: screenshot headless 800×360 com fluxo automático — layout limpo (3 botões, select compacto, raia full-width, hint embaixo)
- CHANGELOG v0.3.0 + este registro; `.gitignore` ganha `print.jpeg`

### Decisões
- Confirmação de zerar mantida (PRD exige confirmação explícita)
- Hold testado **antes** do Parar (mestre rodando) para provar o swallow do click via `masterRunning`; asserção de "dados mantidos" usa o split intacto (staged ainda é 0 nesse ponto — staging nasce no recordFinal, coberto pelos testes de lógica)
- Exceção `animation-duration: 3s !important` no fill do hold para não ser anulada pelo reset global de `prefers-reduced-motion`
- `print.jpeg` gitignorado (diagnóstico do usuário, não é artefato do app)

### Arquivos
- `index.html`
- `js/ui.js`
- `js/main.js`
- `js/gamepad.js`
- `styles/app.css`
- `tests/e2e-checks.js`
- `.gitignore`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 35/35 E2E — verde
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Botões no topo em paisagem (v0.3.1)

### O que foi feito
- **Diagnóstico**: no print do usuário os botões ficavam no meio da tela em paisagem — o grid do media query `landscape + max-height:560px` listava `"header"` como 1ª área; em retrato a ordem já estava correta (`.chrono-controls` é o 1º filho do DOM)
- **Grid reordenado** (`styles/app.css`): `"controls"` → `"displays"` → `"header"` → `"state"` → `"list list"` → `"hint hint"` — botões no topo, cabeçalho (nome/GameSir/tema/som/ajuda) logo abaixo dos cronômetros, conforme pedido do usuário
- **`.chrono-controls` rente ao topo**: `padding-top` de `calc(0.55rem + env(safe-area-inset-top))` → `env(safe-area-inset-top)` — zero de respiro nas duas orientações, safe-area continua protegendo notch/status bar em retrato PWA
- **E2E em paisagem real**: runner ganha `--window-size=800,400` (vp776×308 ≤560 → grid ativo); checks novos: grid ativo, `startBtn.top ≤ 1` (rente) e ordem `controles < displays < cabeçalho`
- **Fix de teste flaky** (`tests/logic.mjs`): `startMaster(state, Date.now())` seguido de `const t0 = Date.now()` — se o relógico tickasse entre as linhas, `split>=50` media 5001ms e `final` 12001ms (FAIL intermitente); agora `t0` é capturado antes e usado nos dois
- CHANGELOG v0.3.1 + este registro

### Decisões
- Cabeçalho **abaixo dos displays** (não logo abaixo dos botões) — escolha explícita do usuário
- Padding rente vale para as **duas orientações** (pedido: "não importa se retrato ou paisagem")
- E2E fixado em 800×400 para sempre cobrir o cenário reportado (o check de `display: grid` acusa se o `--window-size` não pegar, mostrando o vp)
- Print do usuário mostrava build antigo (botão Zerar avulso) — validar redeploy do `cronobase.pages.dev` após o push

### Arquivos
- `styles/app.css`
- `tests/e2e-runner.mjs`
- `tests/e2e-checks.js`
- `tests/logic.mjs`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 38/38 E2E — verde (grid ativo vp=776x308, startBtn.top=0.0)
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Tag de versão discreta no top bar (v0.4.0)

### O que foi feito
- Adicionada constante `APP_VERSION = "0.3.1"` em `js/state.js` (fonte da verdade da versão da interface).
- Corrigido `package.json` de `0.1.0` para `0.3.1` (alinhado ao CHANGELOG/AGENTS.md).
- Tag de versão discreta (`v0.3.1`) ao lado do label "CronoBase" no top bar da tela de configuração (`index.html` + `styles/app.css` `.brand-version` + `js/ui.js` `brandVersion`).
- Não foi adicionada versão ao cabeçalho do cronômetro (só top bar, conforme pedido do usuário).
- Não foi adicionado relógio do sistema na status bar do modal (fantasia/alegoria da imagem modelo, conforme pedido do usuário).
- CHANGELOG não atualizado (versão já refletida via tag git v0.4.0).

### Decisões
- Versão só no top bar da config, não no cabeçalho do modal do cronômetro.
- `APP_VERSION` é constante estática entre releases; deve ser bumpada junto com a tag git a cada release.
- Sem alteração no layout do modal do cronômetro além da tag de versão (o modelo fornecido é referência visual, não requisito de reescrita).

### Arquivos
- `package.json`
- `js/state.js`
- `js/ui.js`
- `index.html`
- `styles/app.css`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 38/38 E2E — verde
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Dimensionamento do modal aproximado ao modelo (v0.5.0)

### O que foi feito
- Ajuste de **dimensões apenas** no modal do cronômetro (`styles/app.css`), sem alterar a disposição dos objetos (ordem dos filhos de `#screen-chrono` preservada: controles → displays → cabeçalho → estado → lista → hint).
- `.chrono-controls`: background superfície, botões `.btn-xl` mais altos (60px), fonte 1.15rem, peso 800, raio 16px. Mantém gap ~5cm entre Iniciar e Parar em telas largas e rente ao topo (`padding-top: env(safe-area-inset-top)`).
- `.chrono-displays` / `.display` / `.display-continuous`: borda 2px, raio 24px, padding generoso, sombra suave (aproximando `.timer-main` / `.timer-side` do modelo).
- `.display-label` (kicker): 0.85rem, peso 800, letter-spacing 0.04em, cor `#535d6b`.
- `.display-value` (mestre): clamp até 4.2rem, peso 350, line-height 1.04, letter-spacing 0.04em, branco nowrap.
- `.display-value-sm` (lado): clamp até 2.2rem, peso 350, line-height 1.04.
- `.chrono-header`: alinhamento `flex-start`; `.chrono-name` 1.15rem peso 800; `.chrono-config` 0.95rem cor `#596474` com margem superior.
- `.gp-badge`: pílula maior (0.85rem, padding 0.35rem 0.75rem, raio 28px).
- Raias (`.raia`): gap 0.8rem, padding 0.55rem 0.75px; `.raia-lane` 1.25rem azul; `.raia-name` 1.05rem peso 800; `.raia-meta` 0.95rem cor `#596474`; `.raia-clock` peso 350, line-height 1.04, letter-spacing 0.04em; `.raia-tag` pílula raio 28px.
- `.chrono-hint`: 0.85rem, peso 600.

### Decisões
- Disposição preservada intencionalmente: a experiência do usuário (fluxo dos objetos) foi mantida; apenas dimensões foram aproximadas ao modelo enviado.
- Sem relógio do sistema na status bar do modal (fantasia/alegoria da imagem modelo).
- Versão discreta mantida apenas no top bar da config (não no cabeçalho do modal).

### Arquivos
- `styles/app.css`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 38/38 E2E — verde (grid ativo vp=776x308, startBtn.top=0.0, ordem c=0 d=70 h=189)
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Sincronização da versão exibida com as tags (v0.5.1/v0.5.2)

### O que foi feito
- **Diagnóstico**: o top bar exibia `v0.3.1` mesmo com a tag `v0.5.0` no repositório — `APP_VERSION` (`js/state.js`) e `"version"` (`package.json`) não tinham sido bumpadas desde a sessão v0.4.0
- `APP_VERSION` → `0.5.1` + `package.json` → `0.5.1` no commit `fix:` (hook gerou a tag `v0.5.1`); em seguida bump para `0.5.2` neste registro de sessão (tag `v0.5.2` via hook)
- `AGENTS.md`: "Versão atual" → v0.5.2; cabeçalho de última-sessão atualizado
- `npm run check` + `npm test` verdes antes de cada commit

### Decisões
- `APP_VERSION` acompanha a tag do commit em que é commitada (exibir ≠ "próxima release"): o `post-commit` taggeia **todo** commit (inclusive `docs:`), então a única forma de display == tag é bumpar junto com cada tag nova
- Dois commits (fix v0.5.1 + docs v0.5.2) em vez de um só: o fix foi validado e empurrado antes de escrever o registro, seguindo o ciclo done → commit → push

### Arquivos
- `js/state.js`
- `package.json`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + 38/38 E2E — verde
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Modal reestruturado conforme mockup do usuário (v0.6.0)

### O que foi feito
- Usuário forneceu HTML exportado do Figma ("a experiência do usuário seja esta") e definiu: ignorar chrome do celular (status bar/home indicator), manter state line discreta, `?` no canto inferior direito, botões Iniciar=azul/Parar=vermelho/Resumo=**cinza**
- `index.html`: reestrutura `#screen-chrono` em 2 rows + rodapé — Row 1 `.chrono-controls` com 3 zonas (`#summaryBtn` cinza à esquerda · `.controls-center` com Iniciar/Parar (gap ~5cm ≥641px) · `.controls-right` com display `Sessão contínua` + `#gpStatus` + `#soundBtn`); Row 2 `.chrono-header` com título à esquerda, **card mestre ao centro** e `#themeSelectChrono` à direita; `#helpBtnChrono` sai do cabeçalho para `.chrono-footer` (absolute, canto inf. direito, safe-area); `masterLabel` → "SÉRIE · MESTRE"
- `styles/app.css`: header vira grid `1fr auto 1fr` ≥641px (card centralizado de verdade) e flex-wrap com `order` no mobile (card em linha própria, `margin:0 auto`); state-line 0.75rem; footer com border-top + hint com padding p/ não passar por baixo do `?`; raia selecionada `border-width:4px`; `.display-label` ganha `text-transform:uppercase`; grid de paisagem perde a área `"displays"` e ganha compressão da row 1 (fontes/gaps/pill menores p/ caber **uma linha** em 776px — sem isso a lista de raias ficava com ~0px de altura); `#summaryBtn` cinza via `--surface-2`
- `tests/e2e-checks.js`: ordem paisagem agora `controles → cabeçalho → lista` (`.chrono-displays` não existe mais) + check novo `? no canto inferior direito (help.top ≥ list.bottom)`
- `APP_VERSION`/`package.json` → 0.6.0 (display == tag do feat)
- CHANGELOG v0.6.0 + este registro

### Decisões
- Estado do modal preservado por **IDs** (`startBtn`, `masterDisplay`, etc.) — `js/ui.js`/`js/main.js` **zero mudança**; mudança é HTML+CSS+1 check
- `.controls-center { flex: 1 1 0 }` (basis 0) garante que em telas estreitas só o grupo da direita quebra p/ 2ª linha, mantendo Resumo·Iniciar·Parar juntos na 1ª
- Gap 5cm mantido como requisito (v0.2.1); compressão em paisagem usa fonte/padding menores para o par caber, sem reduzir o gap
- Chrome do Figma (10:45/5G/bateria/home indicator) ignorado — decisão do usuário
- Screenshots de validação: `--screenshot` do Edge headless era **não-confiável** (capturava estado com perfil reutilizado/sel=0 — artefato, não bug do app; `diag` via `--dump-dom` provou modal abre e permanece); solução final: **CDP puro** (`--remote-debugging-port` + WebSocket do Node 24 + `Page.captureScreenshot` só após `screen-chrono.open===true`) — scripts em `%TEMP%\opencode\` (fora do repo)

### Arquivos
- `index.html`
- `styles/app.css`
- `tests/e2e-checks.js`
- `js/state.js`
- `package.json`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + **39/39 E2E** — verde (novo check do `?`)
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Kebab menu, drag livre e 4 cards (v0.7.0)

### O que foi feito
- **Kebab substitui o 🔔** na row de controles: `#kebabBtn` (3 pontos via
  `box-shadow`, `currentColor` p/ temas) + `#kebabPanel` com os itens
  `#soundBtn` ("Alerta sonoro" + estado Ligado/Desligado) e
  `#helpBtnChrono` ("Ajuda/controles") — IDs preservados, bindings de
  `soundToggle`/`openHelp` intactos; `setSoundOn` agora atualiza
  `.kebab-ico`/`.kebab-state` (nunca `textContent` no botão)
- **Rodapé removido** (hint + `?`): grid de paisagem perde as áreas
  `state`/`hint` → `controls/header/list`; `.raia-list` ganha
  `padding-bottom` com safe-area; conteúdo do hint vive na Ajuda
- **Dimensões**: card mestre clamp `1.8–2.4rem` (2.1rem em paisagem),
  padding `0.4/0.7`, `max-width` 22rem no retrato (centrado — probe
  confirmou 352px exatos no vp492); `.chrono-name` 0.9rem,
  `.chrono-config` 0.75rem; contínuo com padding 0.22rem/raio 14;
  pílula GameSir `max-width` 9.5rem em paisagem (texto completo)
- **4 cards em paisagem**: state-line oculta, raias 1 linha
  (`.raia-temps` escondido, meta inline com ellipsis, clock 1.05rem,
  tag 0.6rem, handle 24px, padding 0.15rem) — E2E valida com 4 atletas:
  `scroll=169 client=169`
- **Drag&drop de posição livre** (Iniciar/Parar): threshold 8px em
  pointer events (listeners em document, sem `setPointerCapture`),
  congelamento do par **no início** do arraste (senão o outro botão
  "pula" ao entrar no fluxo absolute), salva `cronobase.btnPos.v1`
  (x em fração do palco + y em px) com clamp; `applyBtnPos()` roda em
  `showScreen("chrono")` e no `resize`; `align-self:stretch` no palco
  `free` (sem isso a altura colapsa e o y desloca); gap 5cm migrou de
  `margin` no `#startBtn` para `gap` do `.controls-center` (ordem
  independente); arraste cancela o long-press do Parar e engole o click
  (`suppressClickUntil`)
- **Esc do kebab**: keydown em capture com `preventDefault` — fecha só
  o menu, nunca chega no `cancel` do `<dialog>` (exitChrono)
- E2E: remove check do `?` (rodapé fora); +7 checks de kebab, +3 de
  drag, +3 de 4 cards → **51 PASS**; `APP_VERSION`/`package.json` → 0.7.0

### Decisões
- Posição livre em **% do palco** (não px absolutos) + clamp — funciona
  entre retrato/paisagem e diferentes larguras; usuário re-ajusta quando
  quiser ("sempre que necessário")
- Colisão de timing conhecida no screenshot: `startBtn.click()` dos
  `setTimeout` de split borbulha até o listener de "click fora" e fecha
  o kebab — **comportamento correto do app** (clique fora fecha); o shot
  do kebab espera os splits terminarem
- State-line oculta só no paisagem (escola aprovada p/ caber 4 cards);
  retrato mantém
- Raias compactas só no paisagem; retrato mantém 2 linhas + chips

### Arquivos
- `index.html`
- `styles/app.css`
- `js/ui.js`
- `tests/e2e-checks.js`
- `js/state.js`
- `package.json`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + **51/51 E2E** — verde
- Screenshots CDP (800×400 e 500×860): kebab aberto, 4 cards, sem
  rodapé — batem com o pedido
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Sessão contínua no meio, gap 5cm removido (v0.8.0)

### O que foi feito
- Usuário: "o botão parar está com a trava de 5cm… retire a delimitação
  e isole o botão igual ao 'iniciar'; coloque 'sessão contínua' entre
  os 2 botões"
- `index.html`: `.display-continuous` sai de `.controls-right` e entra
  em `.controls-center` **entre** `#startBtn` e `#stopBtn`; direita
  fica só pílula GameSir + kebab
- `styles/app.css`: apagado `@media (min-width:641px) { .controls-center
  { gap: 5cm } }` (gap base 0.5rem em todas as larguras); `.controls-center`
  `flex: 1 1 0 → 1 1 min-content` — **basis min-content é o ponto
  crítico**: basis 0 sumia o palco do cálculo de wrap e a pílula
  estourava p/ fora em ~490px; basis auto deixava o Resumo sozinho na
  linha 1 em ~430px; min-content pareia Resumo+trio e quebra só o
  grupo direito; seletores do card compacto repontados de
  `.controls-right .display-continuous` → `.controls-center …` (base +
  paisagem)
- MQ nova `@media (max-width:400px) and (portrait)`: comprime fontes/
  padding/gaps do trio (btn 1.05rem, gaps 0.4rem, dígitos do cont 0.9rem)
  mantendo 2 linhas em 430/390px
- E2E: +1 check `sessão contínua entre Iniciar e Parar` (ordem de rects);
  **52 PASS**; `APP_VERSION`/`package.json` → 0.8.0
- `AGENTS.md` Contexto Crítico: bullet da linha de controles e do grid
  de paisagem reescritos (5cm removido; áreas `controls/header/list`)
- CHANGELOG v0.8.0 + este registro

### Decisões
- Long-press do Parar (≥3s = Zerar) **mantido** — "isolar igual ao
  Iniciar" foi entendido como espaçamento, não comportamento
- Sondagem CDP com `Emulation.setDeviceMetricsOverride` (o
  `--window-size` do headless tem piso ~500px e não serve p/ 360/390):
  430→2 linhas, 390→2 linhas, 360→3 linhas, todos sem overflow
- Drag&drop: palco continua `.controls-center` (agora com 3 itens) —
  congelamento/só botões afetados, card re-centra sozinho (já era o
  centro visual); `ui.js` sem mudança

### Arquivos
- `index.html`
- `styles/app.css`
- `tests/e2e-checks.js`
- `js/state.js`
- `package.json`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + **52/52 E2E** — verde
- Screenshots CDP: `Resumo | Iniciar [cont] Parar | GameSir ⋮` nas duas
  orientações, sem vazio de 5cm
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Fix: Parar sumindo no modo livre (v0.8.1)

### O que foi feito
- **Bug reportado**: "o botão parar sumiu". Causa: especificidade CSS —
  `#stopBtn { position: relative; overflow: hidden }` (id, v0.3.0,
  contentora do `::after` do long-press) vencia
  `.controls-center.free .btn-xl { position: absolute }` (`0,3,0`).
  Com `cronobase.btnPos.v1` salvo (drag), o Iniciar ia p/ absolute, mas
  o Parar ficava `relative` com `left/top` inline = deslocado relativo à
  posição de fluxo (que já era diferente, com o Iniciar fora do fluxo) →
  sai da viewport e é recortado pelo `overflow: hidden` do modal
- **Correção** (`styles/app.css`): seletor do modo livre ganha o id —
  `.controls-center.free .btn-xl, .controls-center.free #stopBtn`
  (especificidade `1,2,0` > `1,0,0`). `#stopBtn { position: relative }`
  mantido para o modo flex (fill do long-press); em modo livre o
  absolute já é positioned ancestor do fill
- **E2E +1 check de regressão**: `Parar visível após drag (modo livre)` —
  retângulo do `stopBtn` com largura > 0 e dentro da viewport (o fluxo
  antigo só media o `startBtn` e passava com o Parar sumido)
- Repro CDP com `cronobase.btnPos.v1` semeado (`{s:{x:.1},p:{x:.62}}`):
  `free=true`, `stop=[384,0,449,48]` dentro do vp776, screenshot
  confirma os 3 elementos visíveis
- `APP_VERSION`/`package.json` → 0.8.1; CHANGELOG v0.8.1 + este registro

### Decisões
- Sem migração de dados: a posição salva continua válida (clamp p/ os
  limites do palco); se o usuário salvou coords com o bug ativo, o
  clamp as traz de volta p/ dentro do palco — pode re-arrastar
- Não usar `!important` — seletor com id é suficiente e explícito

### Arquivos
- `styles/app.css`
- `tests/e2e-checks.js`
- `js/state.js`
- `package.json`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (11 módulos)
- `npm test`: 46/46 lógica + **53/53 E2E** — verde
- Não há backend (app 100% estática)

---

## Sessão: 22/11/2026 — Kebab 4 ícones, export .xlsx, alinhamento, config 100dvh (v0.9.0)

### O que foi feito
- **Kebab em 3 telas** (config/resumo/cronômetro) com 4 ícones
  `data-action="sound|help|export|clear"`: wrapper `.kebab` ancora painel
  horizontal só-ícone 48px; controlador genérico em `js/ui.js` (toggle,
  click-fora, Esc capture fecha só o menu); dispatch por delegação em
  `document`; `setSoundOn` itera `[data-action="sound"]` (🔔/🔕 + aria);
  remove `#helpBtn`, `#helpBtnSummary` e bindings antigos
- **Rodapé da config extraído**: `.config-footer` (Exportar/Limpar
  histórico) apagado do HTML/CSS; `savedCount` migrou para o cabeçalho do
  novo modal de exportação
- **`js/xlsx.js`** (novo, zero deps): `crc32` + `zipStore` (ZIP método 0)
  + OOXML mínimo (`buildXlsx` → Uint8Array); colunas Sessão…Tempos com
  `inlineStr` e escape XML; `store.deleteSession(id)` +
  `store.downloadXlsx(filename, sessions)`
- **Modal `#exportDialog`**: lista de sessões (nome, data/hora, registros),
  `savedCount`, botão Baixar .xlsx, **✕ por linha** → `confirmAction` →
  exclusão no `localStorage`; handlers novos em `main.js`:
  `openExport`, `deleteSession`, `exportXlsx`, `clearChoices` (guard
  `screen==="config"`); `handleGamepadAction`/`currentDialog` tratam
  `exportDialog`; JSON substituído pelo .xlsx
- **Alinhamento dos 2 cronômetros**: `alignDisplays()` em `js/ui.js`
  (midpoint com clamp conjunto `s ∈ [max(-roomL,tMin+δ), min(roomR,tMax+δ)]`,
  `t = s − δ`); gatilhos `showScreen("chrono")` + `ResizeObserver`;
  bug do primeiro draft (clamp do mestre depois de `s=δ/2` → Δ=21.6px)
  corrigido escolhendo `s` já respeitando os dois clamps (Δ=0.0)
- **Config 100dvh**: `#screen-config` overflow hidden, `.config-main`
  única área rolável, compactação de margens/paddings
- **`user-select:none`** no modal do cronômetro + `touch-callout:none`
  no Parar (long-press não dispara seleção); inputs com regra autor
- **F**: `sw.js` → `cronobase-v4` (+ `js/xlsx.js` no CORE),
  `APP_VERSION`/`package.json` → 0.9.0, `check` inclui `js/xlsx.js`;
  `tests/logic.mjs` +11 checks xlsx; `tests/e2e-checks.js` +33 checks
  (config scroll, kebabs 4 itens ×3 telas, alinhamento ≤2px, userSelect,
  clearChoices com guarda, fluxo export/exclusão) → **86 PASS**;
  CHANGELOG v0.9.0 + este registro

### Decisões
- 4 ambiguidades respondidas pelo usuário: "sessões 1/2/3" = painéis da
  config; 🧹 limpa escolhas da config (não o histórico); export = .xlsx
  puro JS; ✕ por linha apaga a sessão salva (com confirmação)
- `savedCount` só no cabeçalho do modal de export (não mais no rodapé)
- 🧹 sem confirmação mas com guard de tela + toast
- Alinhamento move os dois cronômetros (midpoint), não só o mestre
- JSON removido da exportação (substituído por .xlsx)
- Diagnóstico do Δ=21.6 via script headless temporário (fora do repo)

### Arquivos
- `index.html`
- `styles/app.css`
- `js/xlsx.js` (novo)
- `js/store.js`
- `js/ui.js`
- `js/main.js`
- `js/state.js`
- `sw.js`
- `package.json`
- `tests/logic.mjs`
- `tests/e2e-checks.js`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (12 módulos, inclui `js/xlsx.js`)
- `npm test`: **56/56 lógica + 86/86 E2E** — verde
- Não há backend (app 100% estática)

---

## Sessão: 23/11/2026 — Drums no passo 2, select de tema compacto, topbar 52px (v0.10.0)

### O que foi feito
- **Drum/Slot Machine Picker no passo 2**: `js/drum.js` (novo) substitui os 4 `<input type="number">` por wheels `scroll-snap` com banda central, fade de bordas e teclado (`role="spinbutton"`, ↑/↓/Page/Home/End); cada wheel controla um `<input type="hidden">` **com o id antigo** — `syncConfigFromInputs`, listeners de `change` e `renderConfig` (agora chama `syncDrums()`) sem mudança de contrato. Grades: Repetições 1–20 e Séries 1–10 passo 1 (**1 = "única"** nos dois), Descanso 0–600 e Intervalo 0–1800 passo 10 (rótulos `30 s`)
- **`snapConfig`/`CONFIG_GRIDS`** (`js/state.js`): clamp + arredondamento na grade no load e no sync — descanso legado 35 vira 40; `DEFAULT_CONFIG` (30/60) já estava na grade (nenhum default mudou)
- **Guarda anti-corrupção**: commits de scroll só após interação real (`pointerdown`/`wheel`, janela idle de 300ms renovada a cada scroll) — sem isso, eventos de scroll de layout/snap gravavam `state.config` no meio do treino e o E2E perdia o descanso
- **Select de tema compacto nas 3 telas**: regra por id (`.72rem`, 34px, largura auto) vence `.select`/`.select-sm`/`.chrono-header .select-sm`; `option { font-size }` explícito (`.95rem`/`.85rem`) mantém o popup nativo no tamanho anterior
- **Topbar enxuta (config + resumo)**: padding `.6rem→.35rem` + `.topbar .kebab-btn` 48→40px (pool 56→40; itens do painel continuam 48px) → **75px → 52px**
- `sw.js` → `cronobase-v5` (+ `js/drum.js` no CORE); `APP_VERSION`/`package.json` → 0.10.0; `check` inclui `js/drum.js` (13 módulos)
- **Fix visual**: a banda `position:absolute` tapava o valor central (positivos pintam acima do fluxo) → `.drum-scroll { position:relative; z-index:1 }`, fades `z-index:2`
- E2E +15 checks (fonte/popup/altura do select, topbar ≤60px, 4 drums, centramento do wheel por retângulos Δ≤2px, teclado gravando no estado, grade de 10) → **101 PASS**; screenshots CDP (500×860 e 800×400) validam o visual dos 4 drums e a topbar

### Decisões
- Wheel custom em vez de `<select>` nativo (pedido explícito de slot machine); id antigo no hidden input para não tocar em main/ui
- Setas do teclado no padrão listbox: ↑ = valor anterior, ↓ = próximo
- Valores fora da grade são arredondados no load (decisão do usuário: 0,10,20…)
- Select de tema e ⋮ do topbar abaixo do alvo de toque ≥56px do PRD: pedido explícito de redução
- `scrollTop` bruto não serve de asserção (snap do browser para em `i*40+1` por causa da borda) — E2E mede centramento por retângulos

### Arquivos
- `js/drum.js` (novo)
- `index.html`
- `styles/app.css`
- `js/state.js`
- `js/ui.js`
- `js/main.js`
- `sw.js`
- `package.json`
- `tests/e2e-checks.js`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (13 módulos, inclui `js/drum.js`)
- `npm test`: **56/56 lógica + 101/101 E2E** — verde
- Não há backend (app 100% estática)

---

## Sessão: 23/11/2026 — Tema "Beira de piscina" → "Solar" (alto contraste, v0.11.0)

### O que foi feito
- **Tema Solar** (`tokens.css` `[data-theme="pool"]`): fundo #FFFFFF puro, superfície #F2F6FA, bordas/texto secundário navy #001B44, primária cobalto #0038A8, descanso/ativo Amarelo Volt #D4FF00 (`--blue-soft` e `--warning-soft`), alerta/Parar laranja-boia #E63900 (`--danger` com texto #000), `--motion: 0` (sem animações sob sol forte)
- `js/themes.js`: rótulo `Solar` em `THEME_OPTIONS` (id interno `pool` intacto, zero migração do localStorage)
- `app.css` pool: bordas 2px #001B44, btn-font 800, `btn-danger` laranja + texto #000, `state-line.running` cobalto, `resting` volt/navy, `raia-tag` base cobalto (via `:not()`), `tag-alert` texto #000, `rest-count` volt com número #000, drums adjacentes #4A5568 opacidade 1 peso 500, centro #000 peso 700, banda com bordas cobalto 2px
- `sw.js`: `cronobase-v5` → `cronobase-v6`
- `APP_VERSION`/`package.json`: 0.10.0 → 0.11.0
- `PRD-CronoBase.md` / `README.md`: nome visível "Solar"; seção "Tema Solar (alto contraste)" com paleta; id interno segue `pool`
- E2E +7 checks (rótulos Normal/Noturna/Solar, aplicação do id pool, banda volt, item central preto/bold, adjacente sólido, topbar no Solar, restauração do tema normal) → **108 PASS**
- Screenshots CDP (solar-portrait/landscape/chrono) confirmam visual Solar

### Decisões
- Id interno `pool` mantido (zero migração de localStorage); label visível passa a ser "Solar"
- `.tag-alert` com texto `#000` sobre laranja #E63900 (4.95:1 AAA para texto grande)
- `--motion: 0` / `animation:none` mantido no Solar (operação sob sol forte, sem animações)
- PRD renomeado para "Solar" e paleta documentada

### Arquivos
- `styles/tokens.css`
- `js/themes.js`
- `styles/app.css`
- `sw.js`
- `js/state.js`
- `package.json`
- `PRD-CronoBase.md`
- `README.md`
- `CHANGELOG.md`
- `AGENTS.md`

### Typecheck
- `npm run check`: 0 erros (13 módulos)
- `npm test`: **56/56 lógica + 108/108 E2E** — verde
- Não há backend (app 100% estática)
