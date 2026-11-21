<!-- última-sessão: 21/11/2026 — validação E2E, testes permanentes e v0.1.0 -->
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
- **Versão atual:** v0.1.0
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
| `js/state.js` | Estado singleton da sessão, `DEFAULT_CONFIG`, `uid` |
| `js/ui.js` | Camada de renderização (única que toca o DOM de dados) |
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
- **Testes E2E rodam em navegador headless** com `--dump-dom` e `--virtual-time-budget`; o runner precisa de `spawn` **assíncrono** (spawnSync bloqueia o event loop e o servidor HTTP local morre de fome — o Edge trava até o timeout).
- **`npm run check`** = sintaxe (`node --check`) de todos os módulos; **`npm test`** = lógica + E2E. Ambos verdes antes de qualquer commit.

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
