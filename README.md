# CronoBase

Cronômetro de treino **PWA (Modo 2)** da Fizapp — natação/treino em grupo com controle de GameSir X5 Lite, três temas visuais e funcionamento offline.

![Version](https://img.shields.io/badge/version-0.1.0--dev-blue)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## Funcionalidades

- **Modo 2 (Tempo/Parcial):** mestre contínuo + parciais por atleta, seleção automática round-robin entre raias ativas.
- **Configuração de sessão:** nome do treino, estilo, distância (25–400 m), repetições, descanso, séries e intervalo — em 3 passos.
- **Multi-atleta:** cadastro rápido, seleção por sessão, reordenação de raias por arrasto.
- **Regras do motor:** distância abaixo de 50 m nunca registra split; descanso/intervalo em wall-clock (sobrevive a suspensão da aba); liberação sincronizada quando faltam ≤10 s; rollover de séries preserva registros.
- **Resumo e persistência:** Salvar grava no `localStorage` (até 50 sessões), Descartar descarta sem gravar nada, erro de armazenamento mantém a sessão editável. Exportar/Importar em JSON.
- **GameSir X5 Lite:** mapeamento por borda (edge), debounce ~200 ms, priming ao conectar, detecção de desconexão silenciosa. Nenhum botão fecha ou destrói sessão sem confirmação.
- **Três temas:** Normal, Noturna e Solar — troca durante a sessão sem alterar relógios, tempos nem seleções.
- **PWA offline:** service worker cacheia os assets; atualização nunca força reload com sessão não salva sem confirmação.
- **Sem backend, sem conta:** tudo local, 100% no aparelho.

## Tecnologias

- **Frontend:** JavaScript ES modules puro (sem framework, sem build step), HTML5, CSS3 com design tokens.
- **Persistência:** `localStorage` (sessões, atletas, configuração, tema, som).
- **PWA:** `manifest.webmanifest` + service worker (`sw.js`) + ícones em `icons/`.
- **Testes:** Node puro (`tests/logic.mjs`) + navegador headless Edge/Chrome (`tests/e2e-runner.mjs`).

## Pré-requisitos

- Node.js 18+ (apenas para scripts de teste/validação — o app em si não precisa de build)
- Python 3 (opcional, apenas para servir localmente — qualquer servidor estático serve)

## Como Rodar Localmente

```bash
# opção 1: Python
npm run serve            # http://localhost:8080

# opção 2: qualquer servidor estático na raiz
npx serve .              # ou: php -S localhost:8080
```

Abra `http://localhost:8080` no navegador. Para instalar como PWA, use a opção "Adicionar à tela inicial" do navegador.

## Testes

```bash
npm run check    # sintaxe de todos os módulos (node --check)
npm run test:logic   # motor do Modo 2 em Node (46 asserções)
npm run test:e2e     # fluxo completo em navegador headless (29 verificações)
npm test         # tudo junto
```

> `test:e2e` requer Edge ou Chrome instalados (ou defina `CRONOBASE_BROWSER` com o caminho do executável).

## Estrutura do Projeto

```
CronoBase/
├── index.html              # App de página única (3 telas: config, cronômetro, resumo)
├── styles/
│   ├── tokens.css          # Design tokens + 3 temas (data-theme)
│   └── app.css             # Layout, componentes, responsivo
├── js/
│   ├── state.js            # Estado da sessão, config padrão, uid
│   ├── clock.js            # msToDisplay, createTicker
│   ├── modo2.js            # Motor do Modo 2 (regras de negócio puras)
│   ├── store.js            # Persistência localStorage (transacional)
│   ├── themes.js           # Troca e persistência de temas
│   ├── wake.js             # Wake Lock, vibração, alerta de visibilidade
│   ├── gamepad.js          # Adaptador GameSir X5 Lite (Gamepad API)
│   ├── ui.js               # Camada de renderização (única que toca o DOM)
│   └── main.js             # Bootstrap e orquestração
├── tests/
│   ├── logic.mjs           # Testes do motor (Node, sem DOM)
│   ├── e2e-checks.js       # Verificações do fluxo completo
│   └── e2e-runner.mjs      # Harness headless (servidor + navegador + relatório)
├── icons/                  # Ícones PWA (192/512/maskable/apple-touch)
├── scripts/                # Utilitários (ícones, scaffold, sessões)
├── docs/                   # Guia de deploy e material do kit
├── manifest.webmanifest    # Manifesta PWA
├── sw.js                   # Service worker (cache offline)
├── _headers                # Headers HTTP (Cloudflare Pages)
├── PRD-CronoBase.md        # Requisitos do produto
├── DEVELOPMENT.md          # Convenções de commit, versionamento e sessões
├── AGENTS.md               # Histórico completo do projeto (substitui SESSION.md)
└── CHANGELOG.md            # Histórico de versões
```

## Deploy

- **Frontend (PWA estática):** Cloudflare Pages — veja [`docs/DEPLOY-CLOUDFLARE.md`](docs/DEPLOY-CLOUDFLARE.md).
- Não há backend: o app é 100% estático e local.

## Documentação

- [`PRD-CronoBase.md`](PRD-CronoBase.md) — requisitos e critérios de aceite
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — versionamento, commits e rotina de registro
- [`AGENTS.md`](AGENTS.md) — histórico de sessões e contexto crítico do projeto
- [`CHANGELOG.md`](CHANGELOG.md) — mudanças por versão

## Licença

MIT
