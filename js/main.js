// Bootstrap e orquestração do CronoBase.

import { state, DEFAULT_CONFIG, ESTILOS, DISTANCIAS, createSession, uid, sessionSummary } from "./state.js";
import { createTicker, msToDisplay } from "./clock.js";
import {
  setHooks, startMaster, stopMaster, resetMaster, recordSplit, recordFinal,
  selectAtleta, tickModo2, reorderRaias,
} from "./modo2.js";
import {
  loadSessions, commitSession, clearSessions, loadAtletas, saveAtletas,
  loadConfig, saveConfig, loadSound, saveSound, downloadJSON,
} from "./store.js";
import { applyTheme, getTheme } from "./themes.js";
import { requestWake, releaseWake, haptic, setActiveCheck } from "./wake.js";
import { initGamepad } from "./gamepad.js";
import * as ui from "./ui.js";

const session = {
  saved: false,
  soundOn: true,
  waitingWorker: null,
  updateApproved: false,
  reg: null,
};

const ticker = createTicker(() => tick());

function now() {
  return Date.now();
}

/* ---------------- Tick do relógio ---------------- */

function tick() {
  const t = now();
  if (state.masterRunning && state.masterStartedAt) {
    state.masterElapsedMs = t - state.masterStartedAt;
  }
  const events = tickModo2(state, t);
  for (const ev of events) {
    if (ev.type === "rest-end") {
      ui.flashResult(`${ev.raia.waitKind === "intervalo" ? "Intervalo" : "Descanso"} concluído — ${ev.raia.nome}`);
      if (session.soundOn) ui.beep();
    }
  }
  if (state.screen === "chrono") ui.renderChronoFrame(state, t);
}

/* ---------------- Configuração ---------------- */

function clamp(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function syncConfigFromInputs() {
  const c = state.config;
  c.nome = ui.els.cfgNome.value.trim().slice(0, 60);
  c.estilo = ui.els.cfgEstilo.value;
  c.distancia = clamp(ui.els.cfgDistancia.value, 25, 400, 50);
  c.repeticoes = clamp(ui.els.cfgRepeticoes.value, 1, 20, 4);
  c.descanso = clamp(ui.els.cfgDescanso.value, 0, 600, 30);
  c.series = clamp(ui.els.cfgSeries.value, 1, 10, 1);
  c.intervalo = clamp(ui.els.cfgIntervalo.value, 0, 1800, 60);
}

function gotoStep(step) {
  syncConfigFromInputs();
  state.step = Math.min(3, Math.max(1, step));
  saveConfig(state.config);
  ui.renderConfig(state, loadSessions().sessions.length);
}

function nextStep() {
  if (state.step < 3) gotoStep(state.step + 1);
}

function prevStep() {
  if (state.step > 1) gotoStep(state.step - 1);
}

function addAtleta() {
  const input = ui.els.novoAtleta;
  const nome = input.value.trim().slice(0, 40);
  if (!nome) {
    ui.toast("Digite um nome para adicionar.", "error");
    return;
  }
  if (state.atletas.some((a) => a.nome.toLowerCase() === nome.toLowerCase())) {
    ui.toast("Esse atleta já está na lista.", "error");
    return;
  }
  const atleta = { id: uid("at"), nome };
  state.atletas.push(atleta);
  state.selectedAtletas.push(atleta.id);
  saveAtletas(state.atletas);
  input.value = "";
  ui.renderConfig(state, loadSessions().sessions.length);
}

function toggleAtleta(id) {
  const i = state.selectedAtletas.indexOf(id);
  if (i >= 0) state.selectedAtletas.splice(i, 1);
  else state.selectedAtletas.push(id);
  ui.renderConfig(state, loadSessions().sessions.length);
}

function removeAtleta(id) {
  state.atletas = state.atletas.filter((a) => a.id !== id);
  state.selectedAtletas = state.selectedAtletas.filter((x) => x !== id);
  saveAtletas(state.atletas);
  ui.renderConfig(state, loadSessions().sessions.length);
}

function startWorkout() {
  syncConfigFromInputs();
  const escolhidos = state.selectedAtletas
    .map((id) => state.atletas.find((a) => a.id === id))
    .filter(Boolean);
  if (escolhidos.length === 0) {
    ui.toast("Selecione ao menos um atleta (passo 3).", "error");
    state.step = 3;
    ui.renderConfig(state, loadSessions().sessions.length);
    return;
  }
  saveConfig(state.config);
  session.saved = false;
  createSession(state, escolhidos);
  state.screen = "chrono";
  ui.showScreen("chrono");
  ui.renderChrono(state);
  ui.renderChronoFrame(state, now());
  requestWake();
}

/* ---------------- Ações do cronômetro ---------------- */

function handleStart() {
  if (state.screen !== "chrono") return;
  const t = now();
  if (!state.masterRunning) {
    if (state.raias.every((r) => r.done)) return;
    if (!state.continuousStartedAt) state.continuousStartedAt = t;
    const ok = startMaster(state, t);
    if (ok) {
      ui.flashResult("Treino iniciado");
      requestWake();
    }
    ui.renderChronoFrame(state, t);
    return;
  }
  const ev = recordSplit(state, t);
  if (ev) {
    ui.flashResult(`Split ${ev.raia.nome} · ${msToDisplay(ev.ms)}`);
    ui.blinkMaster();
  }
  ui.renderChronoFrame(state, t);
}

function handleStop() {
  if (state.screen !== "chrono" || !state.masterRunning) return;
  const t = now();
  const ev = recordFinal(state, t);
  if (ev) {
    ui.flashResult(`${ev.raia.nome} · ${msToDisplay(ev.ms)} registrado`);
    ui.blinkMaster();
  } else {
    // Sem atleta elegível (grupo descansando) → pausa o mestre.
    if (stopMaster(state)) ui.flashResult("Pausado");
  }
  ui.renderChronoFrame(state, t);
}

async function handleReset() {
  const ok = await ui.confirmAction({
    title: "Zerar cronômetro?",
    message:
      "Relógios, parciais e tempos exibidos serão zerados. Os tempos já capturados nesta sessão continuam disponíveis no Resumo até você salvar ou descartar.",
    okLabel: "Zerar",
    danger: true,
  });
  if (!ok) return;
  resetMaster(state, now());
  ui.renderChrono(state);
  ui.renderChronoFrame(state, now());
  ui.toast("Cronômetro zerado.");
}

function openSummary() {
  if (!state.sessionStartedAt && state.raias.length === 0) {
    ui.toast("Nenhuma sessão em andamento.");
    return;
  }
  state.screen = "summary";
  ui.showScreen("summary");
  ui.renderSummary(state);
}

function backToChrono() {
  if (state.raias.length === 0) {
    goConfig(false);
    return;
  }
  state.screen = "chrono";
  ui.showScreen("chrono");
  ui.renderChrono(state);
  ui.renderChronoFrame(state, now());
}

async function exitChrono() {
  if (state.sessionStartedAt && !session.saved) {
    const ok = await ui.confirmAction({
      title: "Sair do cronômetro?",
      message:
        "Os tempos ainda não foram salvos e serão descartados. Para guardá-los, use Resumo → Salvar.",
      okLabel: "Descartar e sair",
      danger: true,
    });
    if (!ok) return;
    discardSession(false);
    return;
  }
  goConfig(false);
}

function goConfig(stopClock) {
  if (stopClock !== false) ticker.stop();
  releaseWake();
  state.screen = "config";
  state.step = 1;
  state.raias = [];
  state.selectedId = null;
  ui.showScreen("config");
  ui.renderConfig(state, loadSessions().sessions.length);
}

/* ---------------- Salvar / descartar ---------------- */

async function saveSession() {
  const ok = await ui.confirmAction({
    title: "Salvar sessão?",
    message: `Os ${state.staged.length} registro(s) serão gravados neste aparelho (${state.config.nome || "Treino"}).`,
    okLabel: "Salvar",
  });
  if (!ok) return;

  const data = {
    id: uid("sess"),
    schemaVersion: 1,
    nome: state.config.nome || "Treino",
    config: { ...state.config },
    startedAt: state.sessionStartedAt,
    savedAt: new Date().toISOString(),
    registros: state.staged,
  };
  try {
    commitSession(data);
  } catch (err) {
    // Erro de gravação: NÃO fecha nem apaga o estado pendente.
    ui.toast("Erro ao salvar. A sessão continua aberta e intacta — tente novamente.", "error");
    console.warn("CronoBase: falha ao gravar sessão.", err);
    return;
  }
  session.saved = true;
  state.staged = [];
  ticker.stop();
  releaseWake();
  const total = loadSessions().sessions.length;
  ui.toast(`Sessão salva (${total} no histórico).`, "success");
  goConfig();
}

async function discardSession(withConfirm = true) {
  if (withConfirm) {
    const ok = await ui.confirmAction({
      title: "Descartar sessão?",
      message: "Os tempos registrados NÃO serão salvos. Essa ação não pode ser desfeita.",
      okLabel: "Descartar",
      danger: true,
    });
    if (!ok) return;
  }
  // Descarte: nunca grava nada silenciosamente.
  state.staged = [];
  session.saved = false;
  ticker.stop();
  releaseWake();
  goConfig();
  ui.toast("Sessão descartada.");
}

/* ---------------- Histórico ---------------- */

function exportHistory() {
  const data = loadSessions();
  if (data.sessions.length === 0) {
    ui.toast("Nenhuma sessão salva para exportar.");
    return;
  }
  downloadJSON("cronobase-sessoes.json", data);
  ui.toast("Exportação iniciada.", "success");
}

async function clearHistory() {
  const ok = await ui.confirmAction({
    title: "Limpar histórico?",
    message: "Todas as sessões salvas neste aparelho serão removidas. Exporte antes se quiser guardar.",
    okLabel: "Limpar",
    danger: true,
  });
  if (!ok) return;
  clearSessions();
  ui.renderConfig(state, 0);
  ui.toast("Histórico limpo.");
}

/* ---------------- Preferências ---------------- */

function setTheme(theme) {
  const applied = applyTheme(theme);
  ui.setThemeChoice(applied);
}

function toggleSound() {
  session.soundOn = !session.soundOn;
  saveSound(session.soundOn);
  ui.setSoundOn(session.soundOn);
  ui.toast(session.soundOn ? "Alerta sonoro ligado." : "Alerta sonoro desligado.");
}

/* ---------------- GameSir ---------------- */

function handleGamepadAction(action) {
  const dialogOpen = ui.els.confirmDialog.open;
  const helpOpen = ui.els.helpDialog.open;

  if (dialogOpen) {
    if (action === "confirm" || action === "primary") ui.els.confirmOkBtn.click();
    else if (action === "cancel") ui.els.confirmCancelBtn.click();
    return;
  }
  if (helpOpen) {
    if (action === "cancel" || action === "confirm" || action === "primary" || action === "ajuda") {
      ui.els.helpDialog.close();
    }
    return;
  }

  switch (action) {
    case "iniciar":
      handleStart();
      break;
    case "parar":
      handleStop();
      break;
    case "sair":
    case "home-chrono":
      exitChrono();
      break;
    case "resumo":
      openSummary();
      break;
    case "ajuda":
      ui.openHelp();
      break;
    case "avancar":
      if (state.screen === "config") nextStep();
      break;
    case "voltar":
      if (state.screen === "summary") backToChrono();
      else if (state.screen === "config") prevStep();
      break;
    case "salvar":
      if (state.screen === "summary") saveSession();
      break;
    case "home":
      if (state.screen === "chrono") exitChrono();
      else if (state.screen === "summary") backToChrono();
      break;
    default:
      break;
  }
}

/* ---------------- PWA ---------------- */

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("sw.js")
    .then((reg) => {
      session.reg = reg;
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            session.waitingWorker = nw;
            ui.showUpdateBanner();
          }
        });
      });
    })
    .catch((err) => console.warn("CronoBase: SW não registrado.", err));

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (session.updateApproved && !refreshing) {
      refreshing = true;
      location.reload();
    }
  });
}

async function applyUpdate() {
  const hasUnsaved = state.sessionStartedAt && !session.saved;
  if (hasUnsaved) {
    const ok = await ui.confirmAction({
      title: "Atualizar agora?",
      message:
        "A sessão atual tem tempos não salvos que serão perdidos ao recarregar. Cancele, abra o Resumo e salve antes de atualizar.",
      okLabel: "Atualizar (perder dados)",
      danger: true,
    });
    if (!ok) return;
  }
  session.updateApproved = true;
  if (session.waitingWorker) {
    session.waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } else {
    location.reload();
  }
}

function guardBeforeUnload(e) {
  if (state.sessionStartedAt && !session.saved && state.staged.length > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
}

/* ---------------- Init ---------------- */

function init() {
  ui.initUI();

  // Tema inicial.
  setTheme(getTheme());

  // Selects de estilo/distância.
  ui.els.cfgEstilo.replaceChildren();
  for (const est of ESTILOS) {
    const opt = document.createElement("option");
    opt.value = est;
    opt.textContent = est;
    ui.els.cfgEstilo.appendChild(opt);
  }
  ui.els.cfgDistancia.replaceChildren();
  for (const d of DISTANCIAS) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = `${d} m`;
    ui.els.cfgDistancia.appendChild(opt);
  }

  // Estado persistido.
  const savedCfg = loadConfig();
  if (savedCfg) Object.assign(state.config, DEFAULT_CONFIG, savedCfg);
  state.atletas = loadAtletas();
  session.soundOn = loadSound();
  ui.setSoundOn(session.soundOn);

  // Hooks do motor M2.
  setHooks({
    haptic,
    blink: () => ui.blinkMaster(),
    startTicker: () => ticker.start(),
    stopTicker: () => ticker.stop(),
    groupStopped: () => {
      ui.flashResult("Treino concluído!");
      if (session.soundOn) ui.beep();
      if (state.screen === "chrono") ui.renderChronoFrame(state, now());
    },
  });
  setActiveCheck(() => state.sessionStartedAt !== null && !session.saved);

  // Eventos de UI.
  ui.on("themeChange", setTheme);
  ui.on("gotoStep", gotoStep);
  ui.on("prevStep", prevStep);
  ui.on("nextStep", nextStep);
  ui.on("startWorkout", startWorkout);
  ui.on("addAtleta", addAtleta);
  ui.on("toggleAtleta", toggleAtleta);
  ui.on("removeAtleta", removeAtleta);
  ui.on("start", handleStart);
  ui.on("stop", handleStop);
  ui.on("reset", handleReset);
  ui.on("openSummary", openSummary);
  ui.on("backToChrono", backToChrono);
  ui.on("exitChrono", exitChrono);
  ui.on("discard", () => discardSession(true));
  ui.on("saveSession", saveSession);
  ui.on("selectRow", (id) => {
    if (selectAtleta(state, id)) ui.renderChronoFrame(state, now());
  });
  ui.on("reorder", (fromId, toId) => {
    if (reorderRaias(state, fromId, toId)) {
      ui.renderChrono(state);
      ui.renderChronoFrame(state, now());
    }
  });
  ui.on("soundToggle", toggleSound);
  ui.on("exportHistory", exportHistory);
  ui.on("clearHistory", clearHistory);
  ui.on("applyUpdate", applyUpdate);

  // Inputs de configuração.
  for (const id of ["cfgNome", "cfgEstilo", "cfgDistancia", "cfgRepeticoes", "cfgDescanso", "cfgSeries", "cfgIntervalo"]) {
    ui.els[id].addEventListener("change", () => {
      syncConfigFromInputs();
      saveConfig(state.config);
      if (id === "cfgDistancia") ui.renderConfig(state, loadSessions().sessions.length);
    });
  }

  // Controle GameSir.
  initGamepad({
    getContext: () => ({ screen: state.screen, dialog: currentDialog() }),
    onAction: handleGamepadAction,
    onStatus: (st) => {
      session.gpStatus = st;
      ui.setGpStatus(st, session.soundOn);
    },
  });

  // PWA.
  registerSW();
  window.addEventListener("beforeunload", guardBeforeUnload);

  // Tela inicial.
  ui.showScreen("config");
  ui.renderConfig(state, loadSessions().sessions.length);
  ui.setGpStatus({ connected: false }, session.soundOn);
}

function currentDialog() {
  if (ui.els.confirmDialog.open) return "confirm";
  if (ui.els.helpDialog.open) return "help";
  return null;
}

init();

// Exportes para depuração no console.
window.cronobase = { state, sessionSummary, tickModo2, msToDisplay };
