// Renderização — única camada que toca no DOM de dados.
// Conteúdo dinâmico usa textContent (sem innerHTML para valores do usuário).

import { msToDisplay, secondsLeft } from "./clock.js";
import { THEME_OPTIONS } from "./themes.js";
import { GP_MAP } from "./gamepad.js";
import { sessionSummary } from "./state.js";

export const els = {};
const handlers = {};
let flash = { text: "", until: 0 };
let suppressClickUntil = 0;
let confirmResolve = null;
// Conta eventos "close" que NÓS provocamos (via resolveConfirm). Um close
// atrasado de uma sessão anterior não pode resolver/fechar a sessão atual.
let expectedCloses = 0;

export function on(name, fn) {
  handlers[name] = fn;
}

function emit(name, ...args) {
  if (handlers[name]) handlers[name](...args);
}

function $(id) {
  return document.getElementById(id);
}

export function initUI() {
  const ids = [
    "screen-config", "screen-chrono", "screen-summary",
    "themeSelect", "themeSelectChrono", "themeSelectSummary",
    "helpBtn", "helpBtnChrono", "helpBtnSummary", "helpDialog", "helpCloseBtn", "gpTable", "gpDiag",
    "stepPills", "stepPanel1", "stepPanel2", "stepPanel3",
    "cfgNome", "cfgEstilo", "cfgDistancia", "cfgRepeticoes", "cfgDescanso", "cfgSeries", "cfgIntervalo",
    "novoAtleta", "addAtletaBtn", "atletasList", "atletasHint", "distHint",
    "prevStepBtn", "nextStepBtn", "startWorkoutBtn",
    "savedCount", "exportBtn", "clearHistoryBtn",
    "chronoName", "chronoConfig", "gpStatus", "soundBtn",
    "masterDisplay", "continuousDisplay", "chronoStateLine",
    "startBtn", "stopBtn", "resetBtn", "summaryBtn", "chronoList",
    "summaryTitle", "summaryMeta", "summaryList",
    "backToChronoBtn", "discardBtn", "saveSessionBtn",
    "confirmDialog", "confirmTitle", "confirmMessage", "confirmCancelBtn", "confirmOkBtn",
    "toast", "updateBanner", "updateBtn", "updateDismissBtn",
  ];
  for (const id of ids) els[id] = $(id);

  // Tema: três selects espelhados.
  for (const sel of [els.themeSelect, els.themeSelectChrono, els.themeSelectSummary]) {
    sel.innerHTML = "";
    for (const t of THEME_OPTIONS) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => emit("themeChange", sel.value));
  }

  // Tabela de mapeamento GameSir (dados reais do app).
  const tbody = els.gpTable.querySelector("tbody");
  for (const row of GP_MAP) {
    const tr = document.createElement("tr");
    for (const key of ["btn", "fora", "chrono", "dialogo"]) {
      const td = document.createElement("td");
      td.textContent = row[key];
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // Passos da configuração.
  els.stepPills.addEventListener("click", (e) => {
    const pill = e.target.closest(".step-pill");
    if (pill) emit("gotoStep", Number(pill.dataset.step));
  });
  els.prevStepBtn.addEventListener("click", () => emit("prevStep"));
  els.nextStepBtn.addEventListener("click", () => emit("nextStep"));
  els.startWorkoutBtn.addEventListener("click", () => emit("startWorkout"));
  els.addAtletaBtn.addEventListener("click", () => emit("addAtleta"));
  els.novoAtleta.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      emit("addAtleta");
    }
  });

  // Atletas (delegação).
  els.atletasList.addEventListener("click", (e) => {
    const toggle = e.target.closest(".atleta-toggle");
    if (toggle) {
      emit("toggleAtleta", toggle.closest(".atleta-item").dataset.id);
      return;
    }
    const remove = e.target.closest(".atleta-remove");
    if (remove) emit("removeAtleta", remove.closest(".atleta-item").dataset.id);
  });

  // Cronômetro.
  els.startBtn.addEventListener("click", () => emit("start"));
  els.stopBtn.addEventListener("click", () => emit("stop"));
  els.resetBtn.addEventListener("click", () => emit("reset"));
  els.summaryBtn.addEventListener("click", () => emit("openSummary"));
  els.soundBtn.addEventListener("click", () => emit("soundToggle"));

  // Lista de raias: seleção + reordenação por handle (pointer events).
  els.chronoList.addEventListener("click", (e) => {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.target.closest(".raia-handle")) return;
    const li = e.target.closest(".raia");
    if (li) emit("selectRow", li.dataset.id);
  });
  els.chronoList.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const li = e.target.closest(".raia");
    if (li && e.target.classList.contains("raia")) {
      e.preventDefault();
      emit("selectRow", li.dataset.id);
    }
  });
  bindRowDrag();

  // Resumo.
  els.backToChronoBtn.addEventListener("click", () => emit("backToChrono"));
  els.discardBtn.addEventListener("click", () => emit("discard"));
  els.saveSessionBtn.addEventListener("click", () => emit("saveSession"));

  // Ajuda.
  for (const b of [els.helpBtn, els.helpBtnChrono, els.helpBtnSummary]) {
    b.addEventListener("click", () => openHelp());
  }
  els.helpCloseBtn.addEventListener("click", () => els.helpDialog.close());

  // Esc no modal do cronômetro: não fecha direto — pede confirmação de sair.
  els["screen-chrono"].addEventListener("cancel", (e) => {
    e.preventDefault();
    emit("exitChrono");
  });

  // Confirmação.
  els.confirmCancelBtn.addEventListener("click", () => resolveConfirm(false));
  els.confirmOkBtn.addEventListener("click", () => resolveConfirm(true));
  els.confirmDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    resolveConfirm(false);
  });
  els.confirmDialog.addEventListener("close", () => {
    if (expectedCloses > 0) {
      // Fechamento intencional já resolvido por resolveConfirm — ignora.
      expectedCloses -= 1;
      return;
    }
    if (confirmResolve) resolveConfirm(false);
  });

  // Atualização do PWA.
  els.updateBtn.addEventListener("click", () => emit("applyUpdate"));
  els.updateDismissBtn.addEventListener("click", () => hideUpdateBanner());

  // Rodapé da config.
  els.exportBtn.addEventListener("click", () => emit("exportHistory"));
  els.clearHistoryBtn.addEventListener("click", () => emit("clearHistory"));
}

/* ---------------- Telas ---------------- */

export function showScreen(name) {
  const chrono = els["screen-chrono"];

  els["screen-config"].hidden = name !== "config";
  els["screen-summary"].hidden = name !== "summary";

  if (name === "chrono") {
    if (!chrono.open) chrono.showModal();
    window.scrollTo(0, 0);
    // Toast no top layer do modal (fora do dialog ele fica atrás do backdrop).
    chrono.appendChild(els.toast);
  } else {
    if (chrono.open) chrono.close();
    document.body.appendChild(els.toast);
  }
}

export function renderConfig(state, savedCount) {
  const panels = [els.stepPanel1, els.stepPanel2, els.stepPanel3];
  panels.forEach((p, i) => p.classList.toggle("active", i === state.step - 1));
  for (const pill of els.stepPills.children) {
    pill.classList.toggle("active", Number(pill.dataset.step) === state.step);
  }
  els.prevStepBtn.hidden = state.step === 1;
  els.nextStepBtn.hidden = state.step === 3;
  els.startWorkoutBtn.hidden = state.step !== 3;

  els.cfgNome.value = state.config.nome;
  if (els.cfgEstilo.value !== state.config.estilo) els.cfgEstilo.value = state.config.estilo;
  els.cfgDistancia.value = String(state.config.distancia);
  els.cfgRepeticoes.value = String(state.config.repeticoes);
  els.cfgDescanso.value = String(state.config.descanso);
  els.cfgSeries.value = String(state.config.series);
  els.cfgIntervalo.value = String(state.config.intervalo);
  els.distHint.hidden = state.config.distancia >= 50;

  els.savedCount.textContent =
    savedCount === 1 ? "1 sessão salva" : `${savedCount} sessões salvas`;
  renderAtletas(state);
}

function renderAtletas(state) {
  const list = els.atletasList;
  list.replaceChildren();
  if (state.atletas.length === 0) {
    const li = document.createElement("li");
    li.className = "summary-empty";
    li.textContent = "Nenhum atleta cadastrado ainda.";
    list.appendChild(li);
    return;
  }
  for (const a of state.atletas) {
    const selected = state.selectedAtletas.includes(a.id);
    const li = document.createElement("li");
    li.className = "atleta-item" + (selected ? " selected" : "");
    li.dataset.id = a.id;

    const check = document.createElement("span");
    check.className = "atleta-check";
    check.textContent = selected ? "✓" : "";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "atleta-toggle";
    toggle.textContent = a.nome;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "atleta-remove";
    remove.setAttribute("aria-label", `Remover ${a.nome}`);
    remove.textContent = "✕";

    li.append(check, toggle, remove);
    list.appendChild(li);
  }
  const n = state.selectedAtletas.length;
  els.atletasHint.textContent =
    n === 0
      ? "Toque em um atleta para incluir na sessão."
      : `${n} atleta(s) selecionado(s) para o treino.`;
}

/* ---------------- Cronômetro ---------------- */

function rowTemplate(raia) {
  const li = document.createElement("li");
  li.className = "raia";
  li.dataset.id = raia.atletaId;
  li.tabIndex = 0;
  li.setAttribute("role", "button");

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "raia-handle";
  handle.setAttribute("aria-label", `Reordenar ${raia.nome}`);
  handle.textContent = "⠿";

  const lane = document.createElement("span");
  lane.className = "raia-lane";

  const main = document.createElement("div");
  main.className = "raia-main";
  const name = document.createElement("span");
  name.className = "raia-name";
  name.textContent = raia.nome;
  const meta = document.createElement("span");
  meta.className = "raia-meta";
  const temps = document.createElement("div");
  temps.className = "raia-temps";
  main.append(name, meta, temps);

  const right = document.createElement("div");
  right.className = "raia-right";
  const clock = document.createElement("span");
  clock.className = "raia-clock clock";
  const tag = document.createElement("span");
  tag.className = "raia-tag";
  right.append(clock, tag);

  li.append(handle, lane, main, right);
  return li;
}

export function renderChrono(state) {
  const list = els.chronoList;
  list.replaceChildren();
  els.chronoName.textContent = state.config.nome || "Treino";
  els.chronoConfig.textContent = sessionSummary(state);
  for (const raia of state.raias) {
    list.appendChild(rowTemplate(raia));
  }
}

function setTag(el, text, cls) {
  el.textContent = text;
  el.className = "raia-tag" + (cls ? ` ${cls}` : "");
}

function updateRow(li, raia, state, now) {
  const lane = li.querySelector(".raia-lane");
  const meta = li.querySelector(".raia-meta");
  const temps = li.querySelector(".raia-temps");
  const clock = li.querySelector(".raia-clock");
  const tag = li.querySelector(".raia-tag");

  lane.textContent = String(raia.lane);
  meta.textContent = `Série ${raia.serie} · Rep ${raia.rep}/${state.config.repeticoes}`;

  // Tempos da série atual + parciais em andamento (reconstruído por frame).
  temps.replaceChildren();
  for (const t of raia.tempos) {
    const chip = document.createElement("span");
    chip.className = "raia-temp-chip";
    chip.textContent = t;
    temps.appendChild(chip);
  }
  raia.currentSplits.forEach((s, i) => {
    const chip = document.createElement("span");
    chip.className = "raia-temp-chip";
    chip.style.opacity = "0.75";
    chip.textContent = `p${i + 1} ${msToDisplay(s)}`;
    temps.appendChild(chip);
  });

  const selected = state.selectedId === raia.atletaId;
  li.classList.toggle("selected", selected);
  li.setAttribute("aria-pressed", selected ? "true" : "false");
  li.classList.toggle("resting", raia.waiting && !raia.frozen && !raia.restAlert);
  li.classList.toggle("rest-alert", raia.waiting && raia.restAlert);
  li.classList.toggle("done", raia.done);

  clock.classList.remove("rest-count");

  if (raia.done) {
    clock.textContent = raia.lastSplitMs != null ? msToDisplay(raia.lastSplitMs) : "—";
    setTag(tag, "Concluído", "tag-done");
    return;
  }
  if (raia.waiting) {
    if (raia.frozen) {
      clock.textContent = "—";
      setTag(tag, "Aguardando…", "tag-rest");
      return;
    }
    clock.textContent = String(secondsLeft(raia.waitMs));
    clock.classList.add("rest-count");
    const kind = raia.waitKind === "intervalo" ? "Intervalo" : "Descanso";
    setTag(tag, `${kind} ${secondsLeft(raia.waitMs)}s`, raia.restAlert ? "tag-alert" : "tag-rest");
    return;
  }
  if (raia.startedAt > 0) {
    clock.textContent = msToDisplay(now - raia.startedAt);
    setTag(tag, state.masterRunning ? "Nadando" : "Pausado", state.masterRunning ? "" : "tag-rest");
    return;
  }
  clock.textContent = raia.lastSplitMs != null ? msToDisplay(raia.lastSplitMs) : "00:00:00";
  setTag(tag, "Pronto", "");
}

function computeStateLine(state, now) {
  if (now < flash.until && flash.text) return { text: flash.text, cls: "" };
  const sel = state.raias.find((r) => r.atletaId === state.selectedId);
  if (state.masterRunning) {
    const anyResting = state.raias.some((r) => r.waiting);
    return {
      text: `Executando${sel ? ` · selecionado: ${sel.nome}` : " · nenhum atleta selecionado"}${
        anyResting ? " · descansos em andamento" : ""
      }`,
      cls: "running",
    };
  }
  if (state.raias.every((r) => r.done) && state.raias.length > 0) {
    return { text: "Treino concluído · abra o Resumo para salvar ou descartar", cls: "running" };
  }
  if (state.raias.some((r) => r.waiting)) {
    return { text: "Parado · descansos continuam correndo ao retomar", cls: "resting" };
  }
  if (!state.sessionStartedAt) return { text: "Parado · toque em Iniciar", cls: "" };
  return { text: "Pausado · toque em Iniciar para continuar", cls: "" };
}

export function renderChronoFrame(state, now) {
  els.masterDisplay.textContent = state.seriesStartedAt
    ? msToDisplay(now - state.seriesStartedAt)
    : "00:00:00";
  els.continuousDisplay.textContent = state.continuousStartedAt
    ? msToDisplay(now - state.continuousStartedAt)
    : "00:00:00";

  const line = computeStateLine(state, now);
  els.chronoStateLine.textContent = line.text;
  els.chronoStateLine.className = `state-line ${line.cls}`;

  const rows = els.chronoList.children;
  for (let i = 0; i < state.raias.length && i < rows.length; i++) {
    updateRow(rows[i], state.raias[i], state, now);
  }

  // Botões.
  const allDone = state.raias.length > 0 && state.raias.every((r) => r.done);
  const sel = state.raias.find((r) => r.atletaId === state.selectedId);
  const frozenSel = Boolean(sel && sel.waiting && sel.frozen);
  els.startBtn.textContent = state.masterRunning
    ? state.config.distancia >= 50 && sel && !sel.done && !sel.waiting && sel.startedAt > 0
      ? "Split"
      : "Iniciar"
    : "Iniciar";
  els.startBtn.disabled = allDone || frozenSel;
  els.stopBtn.disabled = !state.masterRunning;
  els.resetBtn.disabled = !state.sessionStartedAt && state.raias.every((r) => !r.startedAt && !r.tempos.length);
}

export function blinkMaster() {
  const el = els.masterDisplay;
  el.classList.remove("blink");
  void el.offsetWidth;
  el.classList.add("blink");
}

export function flashResult(text) {
  flash = { text, until: Date.now() + 1600 };
}

/* ---------------- Resumo ---------------- */

export function renderSummary(state) {
  const list = els.summaryList;
  list.replaceChildren();
  els.summaryTitle.textContent = state.config.nome || "Tempos capturados";
  els.summaryMeta.textContent = sessionSummary(state);

  if (state.staged.length === 0) {
    const li = document.createElement("li");
    li.className = "summary-empty";
    li.textContent = "Nenhum tempo capturado ainda.";
    list.appendChild(li);
    return;
  }
  for (const rec of state.staged) {
    const li = document.createElement("li");
    li.className = "summary-item";
    const head = document.createElement("div");
    head.className = "summary-item-head";
    const who = document.createElement("span");
    who.textContent = `${rec.nome} · raia ${rec.raia}`;
    const serie = document.createElement("span");
    serie.className = "muted";
    serie.textContent = `Série ${rec.serie}`;
    head.append(who, serie);

    const sub = document.createElement("div");
    sub.className = "muted";
    sub.style.fontSize = "0.8rem";
    sub.textContent = `${rec.estilo} ${rec.distancia}m · ${rec.repeticoes} reps · descanso ${rec.descanso}s`;

    const times = document.createElement("div");
    times.className = "summary-item-times";
    for (const t of rec.tempos) {
      const chip = document.createElement("span");
      chip.className = "raia-temp-chip";
      chip.textContent = t;
      times.appendChild(chip);
    }
    li.append(head, sub, times);
    list.appendChild(li);
  }
}

/* ---------------- Diálogos, toast, status ---------------- */

export function openHelp(gpStatusText) {
  if (gpStatusText) els.gpDiag.textContent = gpStatusText;
  if (!els.helpDialog.open) els.helpDialog.showModal();
}

export function confirmAction({ title, message, okLabel = "Confirmar", danger = false }) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmOkBtn.textContent = okLabel;
    els.confirmOkBtn.className = "btn " + (danger ? "btn-danger" : "btn-primary");
    if (!els.confirmDialog.open) els.confirmDialog.showModal();
    els.confirmOkBtn.focus();
  });
}

function resolveConfirm(value) {
  const r = confirmResolve;
  confirmResolve = null;
  if (els.confirmDialog.open) {
    expectedCloses += 1;
    els.confirmDialog.close();
  }
  if (r) r(value);
}

let toastTimer = null;
export function toast(message, kind = "") {
  const el = els.toast;
  el.textContent = message;
  el.className = "toast" + (kind ? ` toast-${kind}` : "");
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

export function setGpStatus(status, soundOn) {
  const el = els.gpStatus;
  if (!status.connected) {
    el.textContent = "GameSir: desconectado";
    el.className = "gp-badge gp-off";
    els.gpDiag.textContent = "Nenhum controle conectado.";
    return;
  }
  const custom = status.mapping !== "standard";
  el.textContent = `GameSir: conectado${custom ? " (mapping custom)" : ""}`;
  el.className = "gp-badge " + (custom ? "gp-custom" : "gp-on");
  el.title = `${status.id} · mapping: ${status.mapping} · ${status.buttons} botões`;
  els.gpDiag.textContent = `Conectado: ${status.id} · mapping: ${status.mapping} · botões: ${status.buttons}.`;
  void soundOn;
}

export function setThemeChoice(theme) {
  for (const sel of [els.themeSelect, els.themeSelectChrono, els.themeSelectSummary]) {
    sel.value = theme;
  }
}

export function setSoundOn(on) {
  els.soundBtn.textContent = on ? "🔔" : "🔕";
  els.soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
  els.soundBtn.title = on ? "Alerta sonoro ligado" : "Alerta sonoro desligado";
}

export function setSavedCount(n) {
  els.savedCount.textContent = n === 1 ? "1 sessão salva" : `${n} sessões salvas`;
}

/* ---------------- Alerta sonoro (opcional, sem rede) ---------------- */

let audioCtx = null;
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    for (const [freq, start] of [[880, 0], [660, 0.18]]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.15);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + 0.16);
    }
  } catch {
    /* áudio indisponível */
  }
}

/* ---------------- Atualização do PWA ---------------- */

export function showUpdateBanner() {
  els.updateBanner.hidden = false;
}

export function hideUpdateBanner() {
  els.updateBanner.hidden = true;
}

/* ---------------- Reordenação por arrasto (handle dedicado) ---------------- */

function bindRowDrag() {
  const list = els.chronoList;
  let drag = null;

  list.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".raia-handle");
    if (!handle) return;
    e.preventDefault();
    const li = handle.closest(".raia");
    handle.setPointerCapture(e.pointerId);
    drag = { id: li.dataset.id, li, startY: e.clientY, active: false, target: null };
  });

  list.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.active && Math.abs(e.clientY - drag.startY) > 4) {
      drag.active = true;
      drag.li.classList.add("dragging");
    }
    if (!drag.active) return;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest(".raia") ?? null;
    if (drag.target && drag.target !== under) drag.target.classList.remove("drop-target");
    if (under && under !== drag.li) {
      under.classList.add("drop-target");
      drag.target = under;
    } else {
      drag.target = null;
    }
  });

  const finish = () => {
    if (!drag) return;
    const { id, li, active, target } = drag;
    li.classList.remove("dragging");
    if (target) target.classList.remove("drop-target");
    drag = null;
    if (active) {
      suppressClickUntil = Date.now() + 400;
      if (target && target.dataset.id !== id) emit("reorder", id, target.dataset.id);
    }
  };
  list.addEventListener("pointerup", finish);
  list.addEventListener("pointercancel", finish);
}
