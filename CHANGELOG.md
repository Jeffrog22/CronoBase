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

## [v0.10.0] - 23/11/2026
### Added
- **Drum / Slot Machine Picker no passo 2** (Séries e descanso): novo
  `js/drum.js` com 4 wheels `scroll-snap` (banda central, fade de bordas,
  `role="spinbutton"` + teclado ↑/↓/Page/Home/End) substituindo os inputs
  numéricos — Repetições 1–20 e Séries 1–10 passo 1 (**1 = "única"**),
  Descanso 0–600 e Intervalo 0–1800 passo 10 (rótulos `30 s`, `60 s`…)
- Cada wheel envolve um `<input type="hidden">` com o **mesmo id** antigo:
  `syncConfigFromInputs`, os listeners de `change` e `renderConfig`
  continuam intactos; o drum só grava `value` e dispara `change`
- `snapConfig`/`CONFIG_GRIDS` em `js/state.js`: clamp + arredondamento na
  grade (passo 1 / múltiplos de 10) aplicado no load (valores legados
  fora da grade, ex.: descanso 35 → 40) e em todo sync
- Commits de scroll só ocorrem após interação real (pointer/wheel com
  janela idle de 300ms) — artefatos de layout/snap programático não
  alteram o estado

### Changed
- **Select de tema compacto nas 3 telas** (config, cronômetro, resumo):
  fonte `.72rem`, caixa 34px (antes `.95rem`/56px), largura automática —
  só a caixa fechada; o popup nativo mantém o tamanho atual via
  `option { font-size }` explícito (`.95rem`/`.85rem`)
- **Topbar da config/resumo enxuta**: padding `0.6rem → 0.35rem` e kebab ⋮
  `48 → 40px` (56 → 40 no pool) — altura caiu de ~75px para **52px**
  (itens do painel do kebab seguem em 48px)
- `sw.js` `VERSION → cronobase-v5` + `js/drum.js` no CORE; `APP_VERSION`
  e `package.json` → 0.10.0

### Fixed
- Banda do drum tapava o valor central (elemento `position:absolute`
  pintava acima do conteúdo): `.drum-scroll` ganhou `position:relative;
  z-index:1` e os fades `z-index:2`

### Tests
- `npm run check` com 13 módulos (inclui `js/drum.js`); E2E +15 checks
  (select/fonte/popup/topbar, 4 drums, centro do wheel Δ≤2px, teclado
  gravando no estado, grade de 10) → **56 lógica + 101 E2E PASS**

## [v0.9.0] - 22/11/2026
### Added
- **Exportação .xlsx nativa** (zero dependências): novo `js/xlsx.js`
  gera ZIP store + OOXML mínimo (`crc32`, `zipStore`, `buildXlsx`) com
  colunas Sessão/Data/Hora/Atleta/Raia/Série/Estilo/Distância/Repetições/
  Séries/Descanso/Intervalo/Tempos; `store.downloadXlsx` dispara o download
- **Modal de exportação** (`#exportDialog`): lista as sessões salvas
  (nome, data/hora, nº de registros), `savedCount` no cabeçalho, botão
  Baixar .xlsx e **✕ por linha** que apaga a sessão (com `confirmAction`);
  JSON saiu da exportação (substituído pelo .xlsx)
- **Kebab em 3 telas** (config, resumo, cronômetro) com apenas 4 ícones:
  som 🔔/🔕 · ajuda ❓ · exportar 📊 · limpar 🧹 — wrapper `.kebab`
  ancora o painel horizontal de 48px só-ícone; itens usam `data-action`
  com dispatch por delegação; controlador genérico (toggle/click-fora/Esc)
- **`clearChoices`**: ícone 🧹 limpa as escolhas da tela de config
  (campos → `DEFAULT_CONFIG`, atletas desmarcados, volta ao passo 1);
  fora da config mostra toast "Disponível na tela de configuração.";
  registro de atletas e histórico intactos
- **Alinhamento dos dois cronômetros** (`alignDisplays` em `js/ui.js`):
  Sessão contínua e card mestre dividem o delta de centros entre palco e
  mestre com clamp conjunto (`s ∈ [max(-roomL, tMin+δ), min(roomR, tMax+δ)]`
  e `t = s − δ`) — clamp só do mestre quebrava a centrização (Δ=21.6px);
  gatilhos: `showScreen("chrono")` + `ResizeObserver`
- **Config em 100dvh**: `#screen-config` com `overflow:hidden` e
  `.config-main` como única área rolável; compactação de margens/paddings
  (`.card`, `.steps`, `.config-nav`, `.field`, `.hint`) — a página não rola
- **`user-select:none`** no modal do cronômetro (+ `touch-callout:none`
  no Parar): o long-press ≥3s não dispara seleção/copiar nativa; inputs
  continuam selecionáveis (regra autor)
- Testes: `logic.mjs` +11 checks de xlsx (magic `PK`, workbook, escape
  XML, `crc32("123456789")===0xCBF43926`, contagem de `<row`); E2E +33
  checks (config scroll, kebabs 4 itens nas 3 telas, alinhamento ≤2px,
  userSelect, clearChoices, fluxo export/exclusão) → **86 PASS**

### Changed
- Rodapé da config (`.config-footer` com Exportar/Limpar histórico)
  **removido** — as ações migraram para o kebab; `savedCount` vive só no
  cabeçalho do modal de exportação
- `#helpBtn` (config) e `#helpBtnSummary` (resumo) substituídos pelo kebab
- Kebab do cronômetro: itens agora são só-ícone (48px), sem rótulo de
  estado `.kebab-state`; `setSoundOn` atualiza todos `[data-action="sound"]`
- `handleGamepadAction`/`currentDialog` tratam `exportDialog` aberto
  (cancel/confirm/primary/ajuda → fecha)
- `sw.js` `VERSION` → `cronobase-v4` (+ `js/xlsx.js` no CORE);
  `APP_VERSION`/`package.json` → `0.9.0`

### Removed
- `exportHistory` (JSON) e `clearHistory` (apagar tudo sem seleção) —
  substituídos por export .xlsx e exclusão por linha

## [v0.8.1] - 22/11/2026
### Fixed
- **Botão Parar sumia com o drag aplicado** (posições salvas em
  `cronobase.btnPos.v1`): `#stopBtn { position: relative }` (regra por
  ID da v0.3.0, contentora do fill do long-press) tinha especificidade
  `1,0,0` e vencia `.controls-center.free .btn-xl { position: absolute }`
  (`0,3,0`) — o Parar ficava `relative` com `left/top` inline e era
  deslocado para fora da viewport (recortado pelo `overflow:hidden` do
  modal). Corrigido incluindo o id no seletor do modo livre
  (`.controls-center.free #stopBtn`, especificidade `1,2,0`)
- E2E ganha check de regressão: `Parar visível após drag (modo livre)`
  (retângulo dentro da viewport) — o fluxo antigo só verificava o
  `startBtn` e passava com o Parar sumido

## [v0.8.0] - 22/11/2026
### Changed
- **Sessão contínua movida para o MEIO dos botões**: row de controles
  agora é `Resumo · Iniciar · [Sessão contínua] · Parar | GameSir · ⋮`
  — o card sai de `.controls-right` para `.controls-center`
- **Gap de 5cm entre Iniciar/Parar REMOVIDO** (trava da v0.2.1,
  pedido do usuário): os botões ficam isolados com `gap: 0.5rem`
  uniforme em todas as larguras; `margin-right`/`gap: 5cm` apagados
- `.controls-center` ganha `flex-basis: min-content` — o trio inteiro
  conta no cálculo de quebra de linha: Resumo + trio pareiam na linha 1
  e só a pílula/kebab quebram p/ linha 2 (basis 0 estourava a pílula
  para fora em ~490px; basis auto deixava o Resumo sozinho em ~430px)
- Retrato ≤400px comprime fontes/padding do trio (1.05rem, gaps 0.4rem,
  dígitos do contínuo 0.9rem) mantendo 2 linhas em 430/390px — 360px
  cai p/ 3 linhas sem nenhum overflow (sondado via CDP: 430/390/360
  com `scrollWidth ≤ innerWidth`)
- E2E +1 check: `sessão contínua entre Iniciar e Parar` (rects na ordem)

## [v0.7.0] - 22/11/2026
### Added
- **Menu kebab no lugar do 🔔** (row de controles): ícone de 3 pontos
  abre um painel com **Alerta sonoro** (estado Ligado/Desligado) +
  **Ajuda/controles** — libera espaço para a pílula GameSir (agora com
  texto completo em paisagem, `max-width` 6.5rem → 9.5rem)
- **Drag & drop com posição livre dos botões Iniciar/Parar**: arraste
  (threshold 8px) move o par dentro do palco `.controls-center`;
  coordenadas salvas em `cronobase.btnPos.v1` como fração da largura
  (escala entre orientações) com clamp; vale ao reabrir o modal e a cada
  resize. Arrastar cancela o long-press do Parar (não dispara Zerar por
  acidente) e o click subsequente é engolido; tap normal segue intacto
- Gap ~5cm entre Iniciar/Parar migrado de `margin` no botão para
  `gap` do palco — sobrevive à inversão de ordem feita pelo drag

### Changed
- **Rodapé do modal removido** (hint `LT = Iniciar/Split…` + `?`): o
  conteúdo vive na Ajuda (aberta pelo kebab ou pelo gamepad Y); a lista
  de raias ocupa até a borda inferior (safe-area no `padding-bottom`)
- **Card mestre menor e centralizado**: dígitos clamp
  `2.6–4.2rem → 1.8–2.4rem` (2.1rem no paisagem), padding `0.4/0.7`,
  `max-width` 22rem no retrato (centrado por `margin:0 auto` / grid
  `1fr auto 1fr`)
- **Texto do treino bem menor**: nome `1.15→0.9rem`, config `0.95→0.75rem`
- **Card Sessão contínua menor**: padding `0.22rem`, dígitos
  `1–1.35rem`, raio 14px
- **Paisagem — 4 cards de aluno sem scroll**: state-line oculta (estado
  segue nas tags), raias compactas em 1 linha (chips de parciais
  escondidos — continuam no Resumo), fontes/padding reduzidos, handle
  24px; E2E valida `scrollHeight ≤ clientHeight` com 4 atletas
- `setSoundOn` atualiza ícone + rótulo de estado do item do menu
  (não `textContent` no botão inteiro)

### Fixed
- Esc com o kebab aberto fecha **só o menu** (capture no keydown +
  `preventDefault`) em vez de disparar a confirmação de sair do modal

## [v0.6.0] - 22/11/2026
### Changed
- **Modal do cronômetro reestruturado conforme mockup do usuário** (ordem e
  agrupamento dos objetos, não só dimensões):
  - **Row 1 (controles)**: `Resumo` (cinza) à esquerda · `Iniciar` (azul) ·
    `Parar` (vermelho) centralizados com gap ~5cm · **Sessão contínua**
    (kicker + dígitos) + pill GameSir + 🔔 à direita — tudo em uma linha
    (compressão própria no modo paisagem; quebra para 2ª linha só em
    telas estreitas)
  - **Row 2 (cabeçalho)**: `Treino`/config à esquerda · **card mestre
    `SÉRIE · MESTRE` ao centro** (grid `1fr auto 1fr` ≥641px, empilhado
    centralizado no mobile) · select de tema à direita
  - **State line** mantida, discreta (0.75rem)
  - **Rodapé**: hint centralizado + botão `?` **flutuante no canto
    inferior direito** (saída do cabeçalho), com safe-area
  - Raias: selecionada com **borda 4px** + fundo `--blue-soft`
  - Kickers dos displays em caixa alta (`SÉRIE · MESTRE`,
    `SESSÃO CONTÍNUA`)
- Chrome do mockup (status bar do celular e home indicator) **ignorado** —
  é artefato do Figma, não faz parte do app

### Removed
- Wrapper `.chrono-displays` (contínuo migrou p/ row de controles; mestre
  migrou p/ cabeçalho)

## [v0.3.1] - 22/11/2026
### Fixed
- **Botões no topo em paisagem**: o grid `landscape + max-height:560px`
  agora começa pela linha `controls` (botões → displays → cabeçalho →
  estado → lista → hint) — antes o cabeçalho vinha primeiro e empurrava
  Iniciar/Parar/Resumo para o meio da tela
- `.chrono-controls` **rente ao topo** nas duas orientações:
  `padding-top` perde o respiro de 0.55rem e fica só
  `env(safe-area-inset-top)` (notch/PWA)
- Testes de lógica flaky: `startMaster` e `t0` compartilhavam `Date.now()`
  em linhas distintas — viravam 5001ms/12001ms se o relógio tickasse
  entre elas; agora usam o mesmo `t0`

### Changed
- E2E roda em `--window-size=800,400` (paisagem ≤560px) com checks novos:
  grid de paisagem ativo, botões rentes ao topo (`startBtn.top ≤ 1`) e
  ordem botões → displays → cabeçalho

## [v0.3.0] - 22/11/2026
### Added
- **Zerar via long-press**: segurar o botão **Parar** por ≥3 s dispara o
  Zerar (com confirmação) — barra do cronômetro fica em 3 botões
  (Iniciar · Parar · Resumo); durante o hold um preenchimento em 3 s
  mostra o progresso e háptico confirma o disparo
- Mesmo comportamento no **gamepad**: RT segurado ≥3 s = Zerar; tap curto
  continua sendo Parar (`GP_ZERAR_LONG_MS = 3000`, padrão do Home)
- Parar pausado fica **habilitado** quando há dados (é a via do long-press);
  toque curto pausado mostra o toast "Já pausado."
- E2E: fluxo do long-press (abre confirmação, click engolido, cancel mantém
  dados), check "Parar pausado habilitado" e check "raias sem overflow
  horizontal"

### Fixed
- **Modal em modo paisagem desconfigurado** (print do usuário): a lista de
  raias agora ocupa as duas colunas do grid e o hint vira linha própria
  embaixo — acabou o metade-da-tela-vazia
- Relógio da linha de raia (`00:00:00`) estourava a caixa e criava
  scrollbar horizontal em telas largas — `--clock-size` com cap de 1.7rem
  + `overflow-x: hidden` na lista
- Select de tema do cabeçalho gigante (a opção "Beira de piscina" definia
  a largura) — limitado a 8.5rem com fonte 0.85rem

### Changed
- Badge "✓ selecionado" vira só "✓" em telas ≤640px (a seleção já tem
  borda + anel)
- Dica do rodapé e tabela da Ajuda documentam o long-press
  (Parar/RT segurar 3 s = Zerar)

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
