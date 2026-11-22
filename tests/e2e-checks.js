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
    check(document.querySelectorAll("#chronoList .raia").length === 2, "2 raias renderizadas");
    check($("startBtn").textContent === "Iniciar", "botão mostra Iniciar");
    check($("gpStatus").textContent.includes("desect") || $("gpStatus").textContent.includes("desconect"), "status GameSir visível");

    // 2. Tema troca sem zerar estado
    $("themeSelectChrono").value = "night";
    $("themeSelectChrono").dispatchEvent(new Event("change"));
    check(document.documentElement.dataset.theme === "night", "tema Noturna aplicado");
    check($("masterDisplay").textContent === "00:00:00", "relógio mestre zerado antes de iniciar");

    // 3. Iniciar → Split → Parar (Modo 2, 50 m)
    $("startBtn").click();
    check(window.cronobase.state.masterRunning === true, "Iniciar liga o mestre");
    check(window.cronobase.state.raias.every((r) => r.startedAt > 0), "todas as raias armadas");
    await sleep(150);
    $("startBtn").click();
    check(window.cronobase.state.raias[0].currentSplits.length === 1, "Split registrou parcial");
    check($("startBtn").textContent === "Split", "botão passa a exibir Split");
    await sleep(150);
    $("stopBtn").click();
    const rest = window.cronobase.state.raias.find((r) => r.waiting);
    check(Boolean(rest), "Parar iniciou descanso");
    const row = document.querySelector('#chronoList .raia[data-id="' + rest.atletaId + '"]');
    check(row.classList.contains("resting"), "linha do descanso marcada visualmente");
    check(row.querySelector(".raia-tag").textContent.includes("Descanso"), "tag de Descanso visível");
    check(window.cronobase.state.selectedId !== rest.atletaId, "seleção avançou para próximo atleta");

    // 4. Zerar pede confirmação
    window.__phase = "reset-open";
    $("resetBtn").click();
    await sleep(30);
    check($("confirmDialog").open, "Zerar abre confirmação");
    window.__phase = "reset-cancel";
    $("confirmCancelBtn").click();
    await sleep(30);
    check(window.cronobase.state.staged.length > 0, "cancelar Zerar mantém dados");

    // 5. Resumo + Salvar (com confirmação) → localStorage
    $("summaryBtn").click();
    check(!$("screen-summary").hidden, "resumo abriu");
    check(document.querySelectorAll("#summaryList .summary-item").length >= 1, "resumo lista registros");
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
  } catch (err) {
    results.push(`FAIL exceção: ${err && err.message}`);
  }

  const pre = document.createElement("pre");
  pre.id = "SMOKE-RESULT";
  pre.textContent = "\n" + results.join("\n") + "\n";
  document.body.appendChild(pre);
}

run();
