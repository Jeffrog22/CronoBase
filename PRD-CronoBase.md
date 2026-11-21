# Especificação de implementação — Cronômetro Bônus Fizapp

> Documento de execução para um agente de desenvolvimento. O produto final será um **terceiro app independente**, separado do PBTracker e do app Fizapp principal. Ele será uma feature bônus do Fizapp, com identidade visual compatível, sem dependência de runtime dos outros aplicativos.

## Missão

Construa um PWA independente contendo somente o cronômetro de treino derivado de **PBTracker / SwimBase / Treino / Modo 2 — Tempo/Parcial**, com controle **GameSir X5 Lite** e três temas: **Normal**, **Noturna** e **Beira de piscina**.

O projeto-fonte está em `C:\Users\HP\Desktop\PBSwimTrack`. Antes de codificar, leia `AGENTS.md`, `ARCHITECTURE.md`, `PDR-SwimBase.md`, `swimbase.js`, `app.js`, `index.html` e `styles.css`. A identidade visual completa está no arquivo fornecido pelo usuário `C:\Users\HP\Desktop\app\gaveta\identidade visual Fizapp.txt`. Use esses materiais como referência; este documento define o novo destino independente.

## Resultado esperado

Crie um app autocontido em uma pasta/repositório de destino aprovado pelo solicitante (se já existir um projeto destino, use-o; se não houver, pare antes de escrever fora do workspace e peça o caminho). O app deve poder ser publicado e instalado como PWA sem importar módulos do PBTracker em runtime. Inclua os arquivos necessários, documentação de execução, manifest e service worker. Mantenha a stack vanilla (HTML, CSS, ES modules) salvo se o projeto destino já determinar outra stack.

Não misture o app com o Fizapp principal, não edite o PBTracker para “extrair” código e não replique funcionalidades de balizamento, SwimBase completo, análise, PRs, atletas, turmas ou login. Implemente somente configuração mínima de sessão, cronômetro Modo 2, captura/visualização de tempos, salvamento local e preferências visuais.

## Referência funcional do código existente

Use a implementação real como fonte da verdade, não improvise o comportamento:

- `swimbase.js`: `buildRaias`, `startTreino`, `startMaster`, `stopMaster`, `resetMaster`, `startMasterTicker`, `tickModo2`, `selectM2Atleta`, `recordM2Split`, `recordM2Final`, `autoSelectNextM2`, `persistRegistro`, `checkPrAndFlag`, `renderChronoModo2`, `updateRaiaRow`, `closeTreino`, `finalizeTreino`, `flushStagedTreino` e funções chamadas por elas.
- `app.js`: seção `GameSir X5 Lite`, iniciada perto do comentário `GameSir X5 Lite → controle físico do PBTracker (Gamepad API)`. Leia o bloco inteiro para preservar debounce, leitura de edge, priming, tratamento de conexão/desconexão e distinção de contexto.
- `index.html` e `styles.css`: estrutura e estados visuais do cronômetro SwimBase. Reproduza a semântica necessária com layout novo inspirado no Fizapp, não copie indiscriminadamente todo o CSS antigo.

### Regras centrais do Modo 2

1. Cada atleta tem relógio individual e estado próprio de série/repetição, descanso, parciais, tempo final e conclusão. Há relógio mestre/contínuo para o grupo conforme a lógica atual.
2. O usuário seleciona uma raia/atleta para agir. Só a raia selecionada recebe Parar/tempo final; a ordem de seleção automática deve continuar procurando a próxima raia ativa, não descansando e não concluída.
3. Para distância **menor que 50 m**, a ação de início não vira Split. A função de split retorna sem registrar (`dist < 50`); o controle deve exibir “Iniciar”.
4. Para distância ≥50 m, cada Split registra tempo decorrido desde `raia.startedAt`, guarda na lista da repetição e avança a seleção para o próximo atleta apto.
5. O registro final calcula o tempo da repetição, encerra/avança rep ou série e inicia descanso/intervalo configurado. Após STOP, deve aparecer a contagem de descanso e o alerta de término segundo a regra implementada no código-fonte; respeite também configuração de início automático, se existente no comportamento atual.
6. Descanso e intervalo são medidos em wall-clock: `waitEndsAt = Date.now() + waitMs`, e cada atualização calcula diferença para o relógio atual. Nunca faça decremento fixo a cada tick. Deve permanecer correto em aba suspensa/segundo plano.
7. Atletas com diferença de descanso ≤10 segundos sincronizam congelamento/liberação conforme o original. Relógio mestre para quando todos estiverem liberados/concluídos, seguindo exatamente `tickModo2`.
8. Reordenação por drag usa handle dedicado; preserva clique/seleção após drag. Se mantida no app novo, reconstrua ordem e renumere raias consistentemente; não permita que arrastar conclua ação ou feche tela.
9. Use relógio baseado em timestamps, não em contagem acumulada de intervalos, para limitar deriva. Preservar a precisão de atualização de interface do original (~30 ms), sem usar o tick como fonte de verdade temporal.
10. Adapte com cuidado o mecanismo de staging. No original, o fluxo de treino tem registros/PRs staged e o Salvar faz flush; Cancelar/Fechar descarta. Como este app bônus não inclui PR nem banco completo, implemente uma sessão local mínima com transação coerente: tempos ficam em memória durante a sessão; **Salvar** grava a sessão completa no armazenamento local; Cancelar/fechar pede confirmação se houver dados e descarta; erro de gravação não fecha nem apaga o estado pendente. Nunca grave silenciosamente ao cancelar. Documente esta adaptação.
11. Manter despertar de tela enquanto a sessão estiver ativa, quando Wake Lock estiver disponível; tratar rejeição/ausência sem quebrar o cronômetro e tentar readquirir ao voltar ao primeiro plano, conforme padrão de origem.
12. Manter feedback háptico quando disponível, sem fazer dele requisito para o registro.

### Captura e formato

- Identifique sessão, data/hora, estilo, distância, atleta, raia, série, repetição, parciais e tempo final.
- Mostre parciais por repetição e histórico dos tempos já registrados na sessão.
- Formato de apresentação deve seguir `MM:SS:CC` ou a máscara funcional do app-fonte; centésimos vêm da conversão do tempo em ms. Use `font-variant-numeric: tabular-nums` e fonte monoespaçada nos relógios.
- Conserve entradas válidas especiais que o fluxo de origem aceite (como `S/T`, `NT` e `00:00:00`) se houver importação/edição de tempos. Não tente convertê-las em número sem validar.
- Escapar conteúdo dinâmico e evitar injeção de HTML. Não inserir nome de atleta com `innerHTML` sem escape.

## GameSir X5 Lite: mapa e comportamento

No mapeamento standard já documentado no app-fonte:

```js
const GP = {
  a: 0, b: 1, x: 2, y: 3,
  lb: 4, rb: 5, lt: 6, rt: 7,
  view: 8, menu: 9, l3: 10, r3: 11,
  up: 12, down: 13, left: 14, right: 15,
  home: 16,
};
```

Mapeamento documentado no código de origem:

- **LT (6)** = Iniciar / Split / Voltas, conforme estado e distância.
- **RT (7)** = Parar / finalizar a repetição ou reiniciar conforme o estado implementado.
- **LB (4)** = voltar/navegação contextual fora do cronômetro; não deve abandonar treino ativo sem confirmação.
- **RB (5)** = avançar/navegação contextual fora do cronômetro; não iniciar treino por acidente.
- **B (1)** fecha/volta com comportamento contextual; com sessão ativa deve seguir confirmação de descarte.
- **A (0)**, **X (2)**, **Y (3)** e sistema (View 8/Menu 9/Home 16) têm funções mais amplas no PBTracker. Neste app independente, defina apenas ações necessárias e coerentes; não copie atalhos de navegação para telas que não existem. Se a função não for necessária, deixe o botão sem ação e mostre o mapa no help.
- **Home/Guide (16)**: botão de firmware M não deve ser tratado como Home. O código-fonte registra Home curto (<700ms) e pressionado ≥700ms para funções distintas. Neste app, use curto para tela inicial e segurar para abrir/alternar modo de operação somente se houver ação segura claramente definida; nunca encerrar sessão por long press sem confirmação. Não recrie `GP.m`.

Implemente Gamepad API com os guardas do código-fonte: leitura de botões em edge (pressionou agora, não enquanto mantido), `pressed || value > 0.5` para gatilhos analógicos, debounce por ação (~200 ms), priming ao conectar para não disparar botão que já estava pressionado, limpar estado ao desconectar e evitar borda fantasma quando o contexto muda. Não dispare o mesmo input também por eventos de teclado. Se o browser expuser mapeamento não-standard, não assuma silenciosamente que os índices são iguais: exiba conexão/ID e permita diagnóstico.

Trecho-base para a camada de amostragem (integrar com ações nomeadas, mantendo debounce e lógica contextual do original):

```js
const GP = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7,
  view: 8, menu: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14,
  right: 15, home: 16 };
const GP_DEBOUNCE_MS = 200;
const pressed = new Map();
const lastActionAt = new Map();
let priming = true;

function sampleGamepad(onPress) {
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (!pad) { priming = true; pressed.clear(); return; }
  const justPressed = [];
  for (let i = 0; i < pad.buttons.length; i++) {
    const button = pad.buttons[i];
    const down = Boolean(button.pressed || button.value > 0.5);
    const wasDown = pressed.get(i) === true;
    pressed.set(i, down);
    if (down && !wasDown) justPressed.push(i);
  }
  if (priming) { priming = false; return; }
  const now = performance.now();
  for (const [action, index] of Object.entries(GP)) {
    if (!justPressed.includes(index)) continue;
    const last = lastActionAt.get(action) ?? -Infinity;
    if (now - last < GP_DEBOUNCE_MS) continue;
    lastActionAt.set(action, now);
    onPress(action, { pad, index, now });
  }
}
```

O trecho é somente o scanner. O agente deve completá-lo com loop controlado (`requestAnimationFrame`), tratamento de conexão/desconexão e roteador de ações por estado do cronômetro. Não executar efeitos de interface diretamente no scanner. Condicionar LT/RT ao cronômetro estar aberto e impedir atalhos genéricos de navegarem/fecharem por cima dele.

## Identidade visual Fizapp

Consulte o arquivo de identidade visual completo. Aplicar, no mínimo:

- Fonte: `Inter, system-ui, Avenir, Helvetica, Arial, sans-serif`, antialiasing.
- Azul primário `#2563eb`; variações principais `#eff6ff`, `#dbeafe`, `#60a5fa`, `#1d4ed8`.
- Semânticas: verde para sucesso/registro, vermelho para erro/perigo, âmbar/amarelo para alerta/descanso, cinzas para neutro. Cor semântica deve vir acompanhada de texto/ícone, nunca só cor.
- Raio de cards `12px` aproximado (`rounded-xl`); botões/inputs com raio médio; badges e pills arredondados.
- Cards claros com fundo branco, borda cinza clara, sombra sutil; tipografia com níveis claros e espaço consistente.
- Não introduzir Tailwind só por causa do documento se app independente permanecer vanilla; traduza os tokens para custom properties CSS.

### Tema Normal

- Fundo `#f9fafb`, superfícies brancas, texto principal `#1f2937`, secundário `#4b5563`, bordas `#e5e7eb`, ação primária `#2563eb`.

### Tema Noturna

- Fundo `#030712`, topo `#111827`, cards `#1f2937`, campos `#374151`, texto `#f3f4f6` / `#d1d5db`, bordas `#374151`; azul acessível `#60a5fa`.
- Seletor de tema continua legível no cronômetro e as cores de alerta não podem sumir no dark.

### Tema Beira de piscina

- Tema operacional de luz forte, distinto do noturno: superfícies claras, contraste muito alto, texto escuro, fundos sólidos, bordas fortes e azul primário intenso. Evite transparências, sombras pesadas, texto cinza pálido e indicadores baseados apenas em cor.
- Aumente escala do relógio e dos botões principais; alvos de toque recomendados ≥56 px; mantenha iniciar/parar/split sempre visíveis. Alertas de descanso e estado devem ter texto explícito e diferenciação visual clara.
- Desative animações não essenciais/reduza movimento; mantenha feedback de estado perceptível.

Use tokens CSS e `data-theme` na raiz. Exemplo pronto para integrar:

```css
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --blue: #2563eb; --blue-hover: #1d4ed8;
  --bg: #f9fafb; --surface: #fff; --surface-2: #f3f4f6;
  --text: #1f2937; --muted: #4b5563; --border: #e5e7eb;
  --success: #15803d; --danger: #dc2626; --warning: #b45309;
  --radius-card: 12px; --touch: 48px;
}
[data-theme="night"] {
  color-scheme: dark;
  --bg: #030712; --surface: #111827; --surface-2: #1f2937;
  --text: #f3f4f6; --muted: #d1d5db; --border: #374151;
  --blue: #3b82f6; --blue-hover: #60a5fa;
  --success: #4ade80; --danger: #f87171; --warning: #fbbf24;
}
[data-theme="pool"] {
  color-scheme: light;
  --bg: #fff; --surface: #fff; --surface-2: #eff6ff;
  --text: #111827; --muted: #1f2937; --border: #1f2937;
  --blue: #1d4ed8; --blue-hover: #1e3a8a;
  --success: #166534; --danger: #b91c1c; --warning: #92400e;
  --radius-card: 8px; --touch: 60px;
}
body { margin: 0; background: var(--bg); color: var(--text); }
button, select, input { min-height: var(--touch); font: inherit; }
.clock { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important;
    animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

Persistência simples e resistente a valor inválido:

```js
const THEMES = new Set(["normal", "night", "pool"]);
function applyTheme(theme) {
  const safe = THEMES.has(theme) ? theme : "normal";
  document.documentElement.dataset.theme = safe === "normal" ? "normal" : safe;
  localStorage.setItem("fizapp_timer_theme", safe);
}
applyTheme(localStorage.getItem("fizapp_timer_theme") || "normal");
```

Garanta seletor acessível com nomes visíveis “Normal”, “Noturna”, “Beira de piscina”. Trocar tema durante sessão não reinicia relógios, tempos ou seleções.

## Interface e fluxo

Construa uma tela de configuração curta antes do cronômetro: nome da sessão (opcional), estilo, distância, número de séries/repetições, descanso entre repetições e intervalo entre séries; seleção dos atletas. Não recriar CRUD completo de atletas. Permitir cadastro rápido local de nomes ou importação simples se útil e compatível com o destino. Definir um modelo de dados mínimo e documentá-lo.

Na tela do cronômetro, exibir:

- Cabeçalho com sessão, configuração e estado de conexão GameSir.
- Relógio mestre e tempo contínuo em áreas visualmente distintas.
- Ações grandes **Iniciar/Split**, **Parar**, **Zerar**, **Salvar** conforme estado; confirmação explícita para zerar dados capturados e descartar sessão.
- Lista de atletas ordenável com raia, nome, série/repetição, tempo atual, parciais e contagem regressiva/estado. Seleção visível por borda/fundo e texto, além de cor.
- Descanso/intervalo com segundos restantes e sinal “Descanso”/“Intervalo”; alerta de término visual e sonoro opcional, controlável e sem depender de rede.
- Resumo final da sessão e ações Salvar/Descartar.
- Ajuda de controles com mapeamento real do app novo.

Use português brasileiro. Layout mobile/tablet-first, com safe areas de iPhone, rolagem da lista sem mover o relógio/controles críticos, modo paisagem utilizável e foco/teclado acessíveis. Controles por toque e GameSir devem coexistir sem eventos duplicados.

## Armazenamento e PWA

- Sessões salvas e tema em armazenamento local; não inventar sincronização, conta ou backend.
- Defina claramente esquema, migração de versão e limite/ação de exportação ou limpeza dos dados.
- PWA instalável com nome/ícones/theme color do novo app, cache dos assets locais e uso offline após primeira carga.
- Evite baixar fonte em runtime; usar stack de fontes local do design system, salvo arquivo de Inter incluído licitamente no destino.
- Garanta que atualização do service worker não interrompa sessão em andamento. Não fazer reload automático enquanto houver sessão ativa.

## Sequência de trabalho do agente

1. Leia os documentos e funções indicados; produza para si um mapa conciso do fluxo, dados, chamadas e ações GameSir. Confirme detalhes de auto-início, STOP, zerar, descanso, pausa e salvamento no código, inclusive ramos de erro.
2. Inspecione o projeto destino e suas instruções locais. Não presumir que PBTracker é o destino; é somente fonte de referência. Se não houver caminho de saída disponível, peça-o antes de gravar artefatos fora do workspace permitido.
3. Crie o app independente e adapte somente o Modo 2. Separe motor temporal, estado da sessão, renderização, persistência, temas e adaptador Gamepad em módulos simples.
4. Faça revisão de correspondência funcional contra as funções fonte. Registre qualquer mudança intencional de comportamento, especialmente a persistência adaptada para o app bônus.
5. Valide com ferramentas e procedimentos existentes no destino. Se não houver teste automatizado, não invente framework de testes; faça verificações manuais/estáticas adequadas e relate o que foi realmente validado.
6. Atualize README/documentação do novo app: iniciar localmente por HTTP, instalar como PWA, operação offline, GameSir e temas.
7. Entregue resumo dos arquivos, decisões, validação e limitações. Não commit, push ou publique sem pedido explícito do usuário.

## Critérios de aceite

- App independente roda sem carregar módulos do PBTracker/Fizapp principal.
- Configuração de sessão inicia Modo 2 com múltiplos atletas.
- LT inicia ou registra split apropriado; distância abaixo de 50 m nunca registra split; RT age como parada/finalização conforme estado validado na origem.
- Tempos atribuídos ao atleta/raia selecionados corretamente; seleção automática segue a regra M2.
- Descanso/intervalo usa wall-clock e continua correto após suspensão da aba; alerta de término funciona.
- Séries, repetições, rollover e conclusão preservam os registros e ordem correta.
- Salvar persiste; cancelar descarta; erro de armazenamento conserva sessão editável.
- GameSir edge/debounce/priming/desconexão não geram acionamentos repetidos ou fantasmas; nenhum botão fecha/destrói sessão sem confirmação.
- Temas Normal, Noturna e Beira de piscina são selecionáveis, persistem e podem alternar durante a sessão sem alterar o estado dela.
- Tema Beira de piscina tem contraste e alvos grandes; layout funciona em mobile e tablet.
- PWA abre offline após carga inicial e não força reload durante sessão ativa.

## Nota sobre anexos e autoridade

O arquivo de identidade visual é uma referência de design. O pedido do usuário é criar um app independente de cronômetro bônus e governa o escopo. Não herde instruções de commit, push, deploy ou alteração do produto PBTracker para o novo app; siga as regras do repositório destino se forem aplicáveis, respeitando autorização do usuário.
