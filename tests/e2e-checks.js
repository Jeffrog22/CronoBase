// Testes E2E do fluxo completo — roda em navegador headless.
// Injetado por tests/e2e-runner.mjs no index.html gerado (_e2e.html).
// Uso: npm run test:e2e

const results = [];
function check(cond, msg) {
  results.push(`${cond ? "PASS" : "FAIL"} ${msg}`);
}

window.addEventListener("error", (e) => {
  results.push(`FAIL window.error: ${e.message} @${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  results.push(`FAIL unhandledrejection: ${e.reason && e.reason.message}`);
});

// Rastreia eventos "close" do diálogo de confirmação (diagnóstico de corrida).
const closeLog = [];
window.__closeLog = closeLog;
document.getElementById("confirmDialog").addEventListener("close", () => {
  closeLog.push(`close@${window.__phase || "?"}`);
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const $ = (id) => document.getElementById(id);
  try {
    // 0. Config: viewport travada (sem scroll de página) + kebab de 4 itens
    check(
      document.documentElement.scrollHeight <= window.innerHeight + 1,
      `config sem scroll de página [body=${document.documentElement.scrollHeight} vp=${window.innerHeight}]`
    );
    const cfgMain = document.querySelector(".config-main");
    check(
      getComputedStyle($("screen-config")).overflow === "hidden" && getComputedStyle(cfgMain).overflowY === "auto",
      "só .config-main rola (100dvh)"
    );
    $("kebabBtnCfg").click();
    check(!$("kebabPanelCfg").hidden, "kebab da config abre");
    check(
      document.querySelectorAll("#kebabPanelCfg .kebab-item").length === 4,
      "kebab da config lista 4 itens"
    );
    $("kebabBtnCfg").click();
    check($("kebabPanelCfg").hidden, "kebab da config fecha no toggle");

    // 1. Config: adicionar atleta e iniciar treino
    $("novoAtleta").value = "Ana";
    $("addAtletaBtn").click();
    $("novoAtleta").value = "Bia";
    $("addAtletaBtn").click();
    check(document.querySelectorAll("#atletasList .atleta-item").length === 2, "cadastro rápido cria 2 atletas");
    check(document.querySelectorAll("#atletasList .atleta-item.selected").length === 2, "atletas selecionados por padrão");

    $("nextStepBtn").click(); // → passo 2
    $("nextStepBtn").click(); // → passo 3
    check($("stepPanel3").classList.contains("active"), "navegação de passos");
    $("startWorkoutBtn").click();
    check($("screen-chrono").open, "tela do cronômetro abriu");
    const cr = $("screen-chrono").getBoundingClientRect();
    check(
      cr.top <= 1 && cr.left <= 1 && cr.width >= window.innerWidth - 2 && cr.height >= window.innerHeight - 2,
      `modal cobre a viewport [top=${cr.top.toFixed(1)} left=${cr.left.toFixed(1)} size=${cr.width.toFixed(0)}x${cr.height.toFixed(0)} vp=${window.innerWidth}x${window.innerHeight} bodyScroll=${document.body.scrollHeight}]`
    );
    const gridOn = getComputedStyle($("screen-chrono")).display === "grid";
    check(gridOn, `layout de paisagem (grid) ativo [vp=${window.innerWidth}x${window.innerHeight}]`);
    const sbRect = $("startBtn").getBoundingClientRect();
    check(sbRect.top <= 1, `botões rentes ao topo [startBtn.top=${sbRect.top.toFixed(1)}]`);
    const contRect = document.querySelector(".display-continuous").getBoundingClientRect();
    const stRect = $("stopBtn").getBoundingClientRect();
    check(
      sbRect.right <= contRect.left + 1 && contRect.right <= stRect.left + 1,
      `sessão contínua entre Iniciar e Parar [start.right=${sbRect.right.toFixed(0)} cont=${contRect.left.toFixed(0)}→${contRect.right.toFixed(0)} stop.left=${stRect.left.toFixed(0)}]`
    );
    // Alinhamento dos dois cronômetros (v0.9.0)
    const contC = document.querySelector(".display-continuous").getBoundingClientRect();
    const mastC = $("masterDisplay").getBoundingClientRect();
    const deltaM = Math.abs(contC.left + contC.width / 2 - (mastC.left + mastC.width / 2));
    check(deltaM <= 2, `cronômetros alinhados [Δ=${deltaM.toFixed(1)}px]`);
    // Long-press do Parar não dispara seleção de texto (v0.9.0)
    check(
      getComputedStyle($("stopBtn")).userSelect === "none",
      `Parar sem seleção de texto [userSelect=${getComputedStyle($("stopBtn")).userSelect}]`
    );
    if (gridOn) {
      const cRect = document.querySelector(".chrono-controls").getBoundingClientRect();
      const hRect = document.querySelector(".chrono-header").getBoundingClientRect();
      const lRect = $("chronoList").getBoundingClientRect();
      check(
        cRect.top < hRect.top && hRect.top < lRect.top,
        `ordem paisagem: controles → cabeçalho → lista [c=${cRect.top.toFixed(0)} h=${hRect.top.toFixed(0)} l=${lRect.top.toFixed(0)}]`
      );
    }
    check(document.querySelectorAll("#chronoList .raia").length === 2, "2 raias renderizadas");
    const cl = $("chronoList");
    check(
      cl.scrollWidth <= cl.clientWidth + 1,
      `raias sem overflow horizontal [scroll=${cl.scrollWidth} client=${cl.clientWidth}]`
    );
    check($("startBtn").textContent === "Iniciar", "botão mostra Iniciar");
    check($("gpStatus").textContent.includes("desect") || $("gpStatus").textContent.includes("desconect"), "status GameSir visível");

    // 1.5 Kebab do cronômetro: 4 itens (som, ajuda, exportar, limpar)
    $("kebabBtn").click();
    check(!$("kebabPanel").hidden, "kebab abre o menu");
    const chronoItems = document.querySelectorAll("#kebabPanel .kebab-item");
    check(chronoItems.length === 4, `kebab cronômetro lista 4 itens [n=${chronoItems.length}]`);
    check(
      $("soundBtn").offsetParent !== null && $("helpBtnChrono").offsetParent !== null,
      "menu lista alerta sonoro + ajuda"
    );
    $("helpBtnChrono").click();
    check($("helpDialog").open, "ajuda abre a partir do kebab");
    check($("kebabPanel").hidden, "menu fecha ao abrir a ajuda");
    $("helpCloseBtn").click();
    const soundBefore = $("soundBtn").getAttribute("aria-pressed");
    $("kebabBtn").click();
    $("soundBtn").click();
    check($("soundBtn").getAttribute("aria-pressed") !== soundBefore, "item som alterna o estado");
    check($("kebabPanel").hidden, "menu fecha ao acionar um item");
    $("kebabBtn").click(); // restaura o estado original do som
    $("soundBtn").click();
    $("kebabBtn").click(); // abre de novo p/ testar o click fora
    $("chronoName").click();
    check($("kebabPanel").hidden, "click fora fecha o kebab");
    // 🧹 fora da config → aviso, sem limpar seleção
    $("kebabBtn").click();
    document.querySelector('#kebabPanel [data-action="clear"]').click();
    check(
      $("toast").textContent.includes("Disponível na tela de configuração"),
      "clear fora da config mostra aviso"
    );
    check(
      window.cronobase.state.selectedAtletas.length === 2,
      "clear fora da config NÃO altera seleção"
    );

    // 2. Tema troca sem zerar estado
    $("themeSelectChrono").value = "night";
    $("themeSelectChrono").dispatchEvent(new Event("change"));
    check(document.documentElement.dataset.theme === "night", "tema Noturna aplicado");
    check($("masterDisplay").textContent === "00:00:00", "relógio mestre zerado antes de iniciar");

    // 2.5 Drag&drop: reposiciona Iniciar sem disparar o click
    const sb0 = $("startBtn").getBoundingClientRect();
    const tb0 = $("stopBtn").getBoundingClientRect();
    const cx = tb0.left + tb0.width / 2;
    const cy = tb0.top + tb0.height / 2;
    $("startBtn").dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 7,
        clientX: sb0.left + sb0.width / 2,
        clientY: sb0.top + sb0.height / 2,
      })
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerId: 7, clientX: cx, clientY: cy })
    );
    $("startBtn").dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 7, clientX: cx, clientY: cy })
    );
    check(Boolean(localStorage.getItem("cronobase.btnPos.v1")), "drag salva a posição dos botões");
    check($("startBtn").style.left !== "", "startBtn fora do fluxo (left inline)");
    $("startBtn").click();
    check(window.cronobase.state.masterRunning === false, "click após drag é engolido");
    const tbAfter = $("stopBtn").getBoundingClientRect();
    check(
      tbAfter.width > 0 && tbAfter.left >= -1 && tbAfter.right <= window.innerWidth + 1,
      `Parar visível após drag (modo livre) [left=${tbAfter.left.toFixed(0)} right=${tbAfter.right.toFixed(0)} vw=${window.innerWidth}]`
    );

    // 3. Iniciar → Split → Parar (Modo 2, 50 m)
    $("startBtn").click();
    check(window.cronobase.state.masterRunning === true, "Iniciar liga o mestre");
    check(window.cronobase.state.raias.every((r) => r.startedAt > 0), "todas as raias armadas");
    await sleep(150);
    $("startBtn").click();
    check(window.cronobase.state.raias[0].currentSplits.length === 1, "Split registrou parcial");
    check($("startBtn").textContent === "Split", "botão passa a exibir Split");
    await sleep(150);

    // 3.5 Long-press do Parar (≥3s) pede confirmação de Zerar
    window.__phase = "hold-open";
    $("stopBtn").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await sleep(3200);
    $("stopBtn").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await sleep(30);
    check($("confirmDialog").open, "segurar Parar 3s abre confirmação de Zerar");
    check(window.cronobase.state.masterRunning === true, "mestre segue rodando durante long-press");
    $("stopBtn").click();
    check(window.cronobase.state.masterRunning === true, "click engolido após long-press (não parou)");
    window.__phase = "hold-cancel";
    $("confirmCancelBtn").click();
    await sleep(30);
    check(!$("confirmDialog").open, "cancelar Zerar mantém o cronômetro");
    check(window.cronobase.state.raias[0].currentSplits.length === 1, "cancelar Zerar mantém dados (split intacto)");

    // 4. Parar → descanso (Modo 2, 50 m)
    $("stopBtn").click();
    const rest = window.cronobase.state.raias.find((r) => r.waiting);
    check(Boolean(rest), "Parar iniciou descanso");
    check(!$("stopBtn").disabled, "Parar pausado habilitado com dados (long-press possível)");
    const row = document.querySelector('#chronoList .raia[data-id="' + rest.atletaId + '"]');
    check(row.classList.contains("resting"), "linha do descanso marcada visualmente");
    check(row.querySelector(".raia-tag").textContent.includes("Descanso"), "tag de Descanso visível");
    check(window.cronobase.state.selectedId !== rest.atletaId, "seleção avançou para próximo atleta");

    // 5. Resumo + Salvar (com confirmação) → localStorage
    $("summaryBtn").click();
    check(!$("screen-summary").hidden, "resumo abriu");
    check(document.querySelectorAll("#summaryList .summary-item").length >= 1, "resumo lista registros");
    $("kebabBtnSum").click();
    check(!$("kebabPanelSum").hidden, "kebab do resumo abre");
    check(
      document.querySelectorAll("#kebabPanelSum .kebab-item").length === 4,
      "kebab do resumo lista 4 itens"
    );
    $("kebabBtnSum").click();
    check($("kebabPanelSum").hidden, "kebab do resumo fecha no toggle");
    let clickSeen = false;
    $("saveSessionBtn").addEventListener("click", () => { clickSeen = true; }, { once: true });
    window.__phase = "save-click";
    $("saveSessionBtn").click();
    const openSync = $("confirmDialog").open;
    await sleep(30);
    results.push(
      `INFO clickSeen=${clickSeen} openSync=${openSync} openAfter=${$("confirmDialog").open} staged=${window.cronobase.state.staged.length} screen=${window.cronobase.state.screen} closeLog=[${closeLog.join("|")}]`
    );
    check($("confirmDialog").open, "Salvar abre confirmação");
    window.__phase = "save-ok";
    $("confirmOkBtn").click();
    await sleep(50);
    const raw = localStorage.getItem("cronobase.sessions.v1");
    check(Boolean(raw) && JSON.parse(raw).sessions.length === 1, "sessão gravada no localStorage");
    check(!$("screen-config").hidden, "volta para config após salvar");
    check($("savedCount").textContent.includes("1 sessão salva"), "contador de sessões salvas atualizado");

    // 6. Descartar: com dados em memória, não grava nada
    $("startWorkoutBtn").click(); // reabre (step 3 ainda ativo)
    check($("screen-chrono").open, "nova sessão abre");
    $("startBtn").click();
    await sleep(80);
    $("stopBtn").click();
    check(window.cronobase.state.staged.length === 1, "nova sessão tem 1 registro em memória");
    $("summaryBtn").click();
    window.__phase = "discard-open";
    $("discardBtn").click();
    await sleep(30);
    window.__phase = "discard-ok";
    $("confirmOkBtn").click();
    await sleep(30);
    const afterRaw = localStorage.getItem("cronobase.sessions.v1");
    const after = afterRaw ? JSON.parse(afterRaw) : null;
    check(Boolean(after) && after.sessions.length === 1, "descartar NÃO grava nada (continua 1)");
    check(window.cronobase.state.staged.length === 0, "descartar limpa o staging");

    // 7. 4 cards: adiciona 2 atletas e verifica que todos cabem sem scroll
    $("novoAtleta").value = "Carlos";
    $("addAtletaBtn").click();
    $("novoAtleta").value = "Dani";
    $("addAtletaBtn").click();
    $("startWorkoutBtn").click();
    check($("screen-chrono").open, "sessão com 4 atletas abre");
    check(document.querySelectorAll("#chronoList .raia").length === 4, "4 raias renderizadas");
    const cl4 = $("chronoList");
    check(
      cl4.scrollHeight <= cl4.clientHeight + 1,
      `4 cards cabem sem scroll [scroll=${cl4.scrollHeight} client=${cl4.clientHeight}]`
    );

    // 8. Exportação: modal, lista, exclusão por linha (v0.9.0)
    $("screen-chrono").dispatchEvent(new Event("cancel", { cancelable: true }));
    await sleep(50);
    check(!$("screen-chrono").open && !$("screen-config").hidden, "volta para config (exitChrono)");
    $("kebabBtnCfg").click();
    document.querySelector('#kebabPanelCfg [data-action="export"]').click();
    await sleep(30);
    check($("exportDialog").open, "modal de exportação abre");
    check($("kebabPanelCfg").hidden, "kebab fecha ao abrir exportação");
    const expRows = document.querySelectorAll("#exportList .export-row");
    check(expRows.length === 1, `export lista 1 sessão salva [rows=${expRows.length}]`);
    check($("exportEmpty").hidden, "aviso vazio escondido quando há dados");
    check(!$("exportXlsxBtn").disabled, "botão .xlsx habilitado com dados");
    check($("savedCount").textContent.includes("1 sessão salva"), "savedCount no cabeçalho do modal");
    document.querySelector("#exportList .export-del").click();
    await sleep(30);
    check($("confirmDialog").open, "excluir sessão pede confirmação");
    window.__phase = "del-ok";
    $("confirmOkBtn").click();
    await sleep(50);
    check(
      document.querySelectorAll("#exportList .export-row").length === 0,
      "sessão removida da lista"
    );
    check($("savedCount").textContent.includes("0 sessões"), "savedCount zerado");
    check($("exportXlsxBtn").disabled, "botão .xlsx desabilitado sem dados");
    const delRaw = localStorage.getItem("cronobase.sessions.v1");
    check(
      Boolean(delRaw) && JSON.parse(delRaw).sessions.length === 0,
      "localStorage sem sessões após exclusão"
    );
    $("exportCloseBtn").click();
    check(!$("exportDialog").open, "modal de exportação fecha");

    // 9. Limpar escolhas (só na tela de config)
    $("cfgNome").value = "Teste limpar";
    $("cfgNome").dispatchEvent(new Event("change"));
    check(window.cronobase.state.config.nome === "Teste limpar", "nome preenchido antes do clear");
    $("kebabBtnCfg").click();
    document.querySelector('#kebabPanelCfg [data-action="clear"]').click();
    await sleep(30);
    check(window.cronobase.state.config.nome === "", "clearChoices zera campos da config");
    check(window.cronobase.state.selectedAtletas.length === 0, "clearChoices desmarca atletas");
    check(window.cronobase.state.step === 1, "clearChoices volta ao passo 1");
    check($("cfgNome").value === "", "input nome limpo");
    check(
      document.querySelectorAll("#atletasList .atleta-item").length === 4,
      "registro de atletas intacto após clear"
    );
    check(
      document.querySelectorAll("#atletasList .atleta-item.selected").length === 0,
      "nenhum atleta marcado após clear"
    );
  } catch (err) {
    results.push(`FAIL exceção: ${err && err.message}`);
  }

  const pre = document.createElement("pre");
  pre.id = "SMOKE-RESULT";
  pre.textContent = "\n" + results.join("\n") + "\n";
  document.body.appendChild(pre);
}

run();
