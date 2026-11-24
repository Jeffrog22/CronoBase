// Renderização — única camada que toca no DOM de dados.
// Conteúdo dinâmico usa textContent (sem innerHTML para valores do usuário).

import { msToDisplay, secondsLeft } from "./clock.js";
import { THEME_OPTIONS } from "./themes.js";
import { GP_MAP } from "./gamepad.js";
import { sessionSummary, APP_VERSION } from "./state.js";
import { syncDrums } from "./drum.js";
import { haptic } from "./wake.js";

export const els = {};
const handlers = {};
let flash = { text: "", until: 0 };
let suppressClickUntil = 0;
let confirmResolve = null;

// Posição livre de Iniciar/Parar (drag&drop) — pref por usuário.
const BTN_POS_KEY = "cronobase.btnPos.v1";

function loadBtnPos() {
  try {
    return JSON.parse(localStorage.getItem(BTN_POS_KEY) || "null");
  } catch {
    return null;
  }
}

function saveBtnPos(pos) {
  try {
    localStorage.setItem(BTN_POS_KEY, JSON.stringify(pos));
  } catch {
    /* sem storage: posição vale só até fechar */
  }
}

// Aplica o par salvo (x em fração do palco, y em px) com clamp aos
// limites do palco — vale ao abrir o modal e a cada resize/orientação.
function applyBtnPos() {
  const chrono = els["screen-chrono"];
  if (!chrono || !chrono.open) return;
  const stage = els.startBtn && els.startBtn.closest(".controls-center");
  if (!stage) return;
  const pos = loadBtnPos();
  if (!pos) {
    stage.classList.remove("free");
    for (const b of [els.startBtn, els.stopBtn]) {
      if (b) {
        b.style.left = "";
        b.style.top = "";
      }
    }
    return;
  }
  stage.classList.add("free");
  for (const [b, key] of [
    [els.startBtn, "s"],
    [els.stopBtn, "p"],
  ]) {
    const p = pos[key];
    if (!b || !p) continue;
    const sr = stage.getBoundingClientRect();
    const x = Math.min(Math.max(0, p.x * sr.width), Math.max(0, sr.width - b.offsetWidth));
    const y = Math.min(Math.max(0, p.y), Math.max(0, sr.height - b.offsetHeight));
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
  }
}

// ---------- Alinhamento dos dois cronômetros (v0.9.0) ----------
// A Sessão contínua é centrada dentro de .controls-center (zona entre
// Resumo e badge+kebab) e o card mestre no centro do modal — centros
// diferentes. Divide o delta entre os dois (palco + mestre), com clamp
// ao espaço livre real para nunca sobrepor botões nem texto do título.
function vertOverlap(a, b) {
  return a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

function alignDisplays() {
  const chrono = els["screen-chrono"];
  if (!chrono || !chrono.open) return;
  const stage = els.startBtn && els.startBtn.closest(".controls-center");
  const cont = stage && stage.querySelector(".display-continuous");
  const mast = els.masterDisplay && els.masterDisplay.closest(".display-master");
  if (!stage || !cont || !mast) return;

  // Zera o transform antigo ANTES de medir — senão o delta acumula.
  stage.style.transform = "";
  mast.style.transform = "";
  void chrono.offsetWidth; // reflow: medir com layout limpo

  const c = cont.getBoundingClientRect();
  const m = mast.getBoundingClientRect();
  const delta = m.left + m.width / 2 - (c.left + c.width / 2);
  if (Math.abs(delta) < 0.5) return;

  // ---- clamp do palco (Iniciar/cont/Parar andam juntos) ----
  const chronoR = chrono.getBoundingClientRect();
  const startR = els.startBtn.getBoundingClientRect();
  const stopR = els.stopBtn.getBoundingClientRect();
  let roomR = Math.max(0, chronoR.right - stopR.right - 4);
  let roomL = Math.max(0, startR.left - chronoR.left - 4);
  const sumR = els.summaryBtn.getBoundingClientRect();
  if (vertOverlap(startR, sumR)) {
    roomL = Math.min(roomL, Math.max(0, startR.left - sumR.right - 4));
  }
  const rightZone = stage.parentElement && stage.parentElement.querySelector(".controls-right");
  if (rightZone) {
    const rz = rightZone.getBoundingClientRect();
    if (vertOverlap(stopR, rz)) {
      roomR = Math.min(roomR, Math.max(0, rz.left - stopR.right - 4));
    }
  }

  // ---- clamp do mestre (não cobrir texto do título nem o select) ----
  let tMin = Math.max(0, m.left - chronoR.left - 4) * -1;
  let tMax = Math.max(0, chronoR.right - m.right - 4);
  const header = mast.closest(".chrono-header");
  const hr = header.getBoundingClientRect();
  tMin = Math.max(tMin, Math.max(0, m.left - hr.left - 4) * -1);
  tMax = Math.min(tMax, Math.max(0, hr.right - m.right - 4));
  const titleEl = header.querySelector(".chrono-title");
  if (titleEl) {
    const tr0 = titleEl.getBoundingClientRect();
    if (vertOverlap(m, tr0)) {
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      const tr = range.getBoundingClientRect();
      // range pode passar do clip do ellipsis → prende na caixa do título.
      const textRight = tr.width > 0 ? Math.min(tr.right, tr0.right) : tr0.right;
      tMin = Math.max(tMin, -Math.max(0, m.left - textRight - 4));
    }
  }
  const sel = els.themeSelectChrono;
  if (sel) {
    const sr = sel.getBoundingClientRect();
    if (vertOverlap(m, sr)) {
      tMax = Math.min(tMax, Math.max(0, sr.left - m.right - 4));
    }
  }

  // Escolhe s de forma que t = s - delta caia em [tMin, tMax] e s em
  // [-roomL, roomR] — clamp só do mestre quebrava a centrização (v0.9.0).
  const sLow = Math.max(-roomL, tMin + delta);
  const sHigh = Math.min(roomR, tMax + delta);
  let s;
  if (sLow > sHigh) {
    // Conflito raro: prioriza não cobrir texto do mestre.
    s = sHigh;
  } else {
    s = Math.max(sLow, Math.min(sHigh, delta / 2));
  }
  const t = s - delta;

  stage.style.transform = `translateX(${s}px)`;
  mast.style.transform = `translateX(${t}px)`;
}
// Long-press do Parar: segurar ≥3s dispara Zerar (emit "reset").
const STOP_HOLD_MS = 3000;
let stopHoldTimer = null;
let stopLongFired = false;
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
    "helpBtnChrono", "helpDialog", "helpCloseBtn", "gpTable", "gpDiag",
    "stepPills", "stepPanel1", "stepPanel2", "stepPanel3",
    "cfgNome", "cfgEstilo", "cfgDistancia", "cfgRepeticoes", "cfgDescanso", "cfgSeries", "cfgIntervalo",
    "novoAtleta", "addAtletaBtn", "atletasList", "atletasHint", "distHint",
    "prevStepBtn", "nextStepBtn", "startWorkoutBtn",
    "savedCount",
    "exportDialog", "exportCloseBtn", "exportList", "exportEmpty", "exportXlsxBtn",
    "brandVersion",
    "chronoName", "chronoConfig", "gpStatus", "soundBtn",
    "kebabBtn", "kebabPanel", "kebabBtnCfg", "kebabPanelCfg", "kebabBtnSum", "kebabPanelSum",
    "masterDisplay", "continuousDisplay", "chronoStateLine",
    "startBtn", "stopBtn", "summaryBtn", "chronoList",
    "summaryTitle", "summaryMeta", "summaryList",
    "backToChronoBtn", "discardBtn", "saveSessionBtn",
    "confirmDialog", "confirmTitle", "confirmMessage", "confirmCancelBtn", "confirmOkBtn",
    "toast", "updateBanner", "updateBtn", "updateDismissBtn",
  ];
  for (const id of ids) els[id] = $(id);

  // Tag de versão discreta ao lado do nome do app (top bar da config).
  els.brandVersion.textContent = `v${APP_VERSION}`;

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
  els.startBtn.addEventListener("click", () => {
    if (Date.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      return;
    }
    emit("start");
  });
  // Parar: toque curto = stop; segurar ≥3s = zerar (com confirmação).
  const beginStopHold = () => {
    if (els.stopBtn.disabled) return;
    stopLongFired = false;
    els.stopBtn.classList.add("holding");
    stopHoldTimer = setTimeout(() => {
      stopHoldTimer = null;
      stopLongFired = true;
      els.stopBtn.classList.remove("holding");
      haptic(60);
      emit("reset");
    }, STOP_HOLD_MS);
  };
  const cancelStopHold = () => {
    if (stopHoldTimer) {
      clearTimeout(stopHoldTimer);
      stopHoldTimer = null;
    }
    els.stopBtn.classList.remove("holding");
  };
  els.stopBtn.addEventListener("pointerdown", beginStopHold);
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
    els.stopBtn.addEventListener(ev, cancelStopHold);
  }
  els.stopBtn.addEventListener("click", () => {
    if (Date.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      return;
    }
    if (stopLongFired) {
      stopLongFired = false;
      return;
    }
    emit("stop");
  });
  els.stopBtn.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      beginStopHold();
    }
  });
  els.stopBtn.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") cancelStopHold();
  });
  els.summaryBtn.addEventListener("click", () => emit("openSummary"));

  // ---------------- Kebab menus (som, ajuda, exportar, limpar) --------
  // Controlador genérico: 3 kebabs (config, resumo, cronômetro) com o
  // mesmo comportamento — toggle, click-fora, Esc fecha só o menu.
  // Itens usam data-action e são tratados por delegação.
  const KEBABS = [
    { btn: "kebabBtn", panel: "kebabPanel" },
    { btn: "kebabBtnCfg", panel: "kebabPanelCfg" },
    { btn: "kebabBtnSum", panel: "kebabPanelSum" },
  ];

  const closeAllKebabs = () => {
    for (const k of KEBABS) {
      const panel = els[k.panel];
      const btn = els[k.btn];
      if (panel && !panel.hidden) {
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      }
    }
  };

  for (const k of KEBABS) {
    const btn = els[k.btn];
    const panel = els[k.panel];
    if (!btn || !panel) continue;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel.hidden;
      closeAllKebabs();
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  document.addEventListener("click", (e) => {
    const item = e.target.closest(".kebab-item[data-action]");
    if (item) {
      closeAllKebabs();
      const action = item.dataset.action;
      if (action === "sound") emit("soundToggle");
      else if (action === "help") openHelp();
      else if (action === "export") emit("openExport");
      else if (action === "clear") emit("clearChoices");
      return;
    }
    // Click fora de qualquer kebab aberto → fecha.
    for (const k of KEBABS) {
      const panel = els[k.panel];
      if (!panel || panel.hidden) continue;
      if (panel.contains(e.target) || els[k.btn].contains(e.target)) continue;
      panel.hidden = true;
      els[k.btn].setAttribute("aria-expanded", "false");
    }
  });
  // Esc fecha APENAS o menu — sem preventDefault o `cancel` do <dialog>
  // dispararia exitChrono e pediria confirmação de sair.
  document.addEventListener(
    "keydown",
    (e) => {
      const anyOpen = KEBABS.some((k) => els[k.panel] && !els[k.panel].hidden);
      if (e.key === "Escape" && anyOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeAllKebabs();
      }
    },
    true
  );

  // ---------- Drag&drop: posição livre de Iniciar/Parar ----------
  // Palco = .controls-center. Pref salvo em cronobase.btnPos.v1 como
  // fração da largura do palco (x) + px da altura (y) — escala entre
  // orientações/tamanhos de tela; clamp impede estouro.
  let btnDrag = null;
  const onBtnPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const btn = e.currentTarget;
    const r = btn.getBoundingClientRect();
    btnDrag = {
      btn,
      stage: btn.closest(".controls-center"),
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: e.clientX - r.left,
      oy: e.clientY - r.top,
      moved: false,
    };
  };
  const onBtnPointerMove = (e) => {
    if (!btnDrag || e.pointerId !== btnDrag.id) return;
    const dx = e.clientX - btnDrag.sx;
    const dy = e.clientY - btnDrag.sy;
    if (!btnDrag.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      btnDrag.moved = true;
      // Arrastou: cancela o long-press do Parar (não dispara Zerar).
      cancelStopHold();
      // Congela o par nas posições atuais ANTES de sair do fluxo —
      // sem isso o outro botão "pula" para o centro do palco.
      const sr0 = btnDrag.stage.getBoundingClientRect();
      for (const b of [els.startBtn, els.stopBtn]) {
        const r = b.getBoundingClientRect();
        b.style.left = `${r.left - sr0.left}px`;
        b.style.top = `${r.top - sr0.top}px`;
      }
      btnDrag.stage.classList.add("free");
      btnDrag.btn.classList.add("dragging");
    }
    const { btn, stage } = btnDrag;
    const sr = stage.getBoundingClientRect();
    const x = Math.min(
      Math.max(0, e.clientX - sr.left - btnDrag.ox),
      Math.max(0, sr.width - btn.offsetWidth)
    );
    const y = Math.min(
      Math.max(0, e.clientY - sr.top - btnDrag.oy),
      Math.max(0, sr.height - btn.offsetHeight)
    );
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
  };
  const onBtnPointerUp = (e) => {
    if (!btnDrag || (e.pointerId != null && e.pointerId !== btnDrag.id)) return;
    const { btn, stage, moved } = btnDrag;
    btnDrag = null;
    btn.classList.remove("dragging");
    if (!moved) return; // tap comum → o click normal segue fluxo
    const sr = stage.getBoundingClientRect();
    const pos = {};
    for (const [b, key] of [
      [els.startBtn, "s"],
      [els.stopBtn, "p"],
    ]) {
      const r = b.getBoundingClientRect();
      pos[key] = {
        x: sr.width > 0 ? (r.left - sr.left) / sr.width : 0,
        y: Math.max(0, r.top - sr.top),
      };
    }
    saveBtnPos(pos);
    stage.classList.add("free");
    // Congela o par nas coordenadas recém-salvas (o outro botão sai do
    // fluxo junto e precisa de left/top explícitos).
    for (const [b, key] of [
      [els.startBtn, "s"],
      [els.stopBtn, "p"],
    ]) {
      b.style.left = `${pos[key].x * sr.width}px`;
      b.style.top = `${pos[key].y}px`;
    }
    suppressClickUntil = Date.now() + 350;
  };
  els.startBtn.addEventListener("pointerdown", onBtnPointerDown);
  els.stopBtn.addEventListener("pointerdown", onBtnPointerDown);
  document.addEventListener("pointermove", onBtnPointerMove);
  document.addEventListener("pointerup", onBtnPointerUp);
  document.addEventListener("pointercancel", onBtnPointerUp);
  window.addEventListener("resize", applyBtnPos);

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

  // Ajuda (botão dedicado no kebab do cronômetro; os demais usam data-action).
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

  // Modal de exportação (.xlsx).
  els.exportCloseBtn.addEventListener("click", () => els.exportDialog.close());
  els.exportXlsxBtn.addEventListener("click", () => emit("exportXlsx"));
  els.exportList.addEventListener("click", (e) => {
    const del = e.target.closest(".export-del");
    if (del) emit("deleteSession", del.dataset.del);
  });

  // Alinha os 2 cronômetros sempre que a layout do modal muda (resize,
  // badge GameSir mais largo, tema com kebab 56px…). Transform não
  // altera o box → o observer não realça em loop.
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => alignDisplays());
    ro.observe(els["screen-chrono"]);
    const stage0 = els.startBtn && els.startBtn.closest(".controls-center");
    if (stage0) ro.observe(stage0);
    if (els.masterDisplay) ro.observe(els.masterDisplay.closest(".display-master"));
    if (els.gpStatus) ro.observe(els.gpStatus);
  }
}

/* ---------------- Telas ---------------- */

export function showScreen(name) {
  const chrono = els["screen-chrono"];

  els["screen-config"].hidden = name !== "config";
  els["screen-summary"].hidden = name !== "summary";

  if (name === "chrono") {
    if (!chrono.open) chrono.showModal();
    applyBtnPos();
    alignDisplays();
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
  syncDrums(); // wheels do passo 2 acompanham o estado
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
  const hasData = Boolean(
    state.sessionStartedAt || state.raias.some((r) => r.startedAt || r.tempos.length)
  );
  // Habilitado para Parar (rodando) ou para o long-press Zerar (pausado com dados).
  els.stopBtn.disabled = !state.masterRunning && !hasData;
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
  // Todos os itens de som (kebabs das 3 telas): ícone + aria + title.
  // Nunca textContent no botão inteiro — apagaria o aria-label.
  for (const b of document.querySelectorAll('[data-action="sound"]')) {
    const ico = b.querySelector(".kebab-ico");
    if (ico) ico.textContent = on ? "🔔" : "🔕";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.title = on ? "Alerta sonoro ligado" : "Alerta sonoro desligado";
    b.setAttribute("aria-label", b.title);
  }
}

export function setSavedCount(n) {
  els.savedCount.textContent = n === 1 ? "1 sessão salva" : `${n} sessões salvas`;
}

/* ---------------- Modal de exportação (.xlsx) ---------------- */

export function renderExport(sessions) {
  const list = els.exportList;
  list.replaceChildren();
  const n = sessions.length;
  setSavedCount(n);
  els.exportEmpty.hidden = n > 0;
  els.exportList.hidden = n === 0;
  els.exportXlsxBtn.disabled = n === 0;

  for (const s of sessions) {
    const li = document.createElement("li");
    li.className = "export-row";
    li.dataset.id = s.id;

    const text = document.createElement("div");
    text.className = "export-row-text";
    const name = document.createElement("span");
    name.className = "export-row-name";
    name.textContent = s.nome || "Treino";
    const meta = document.createElement("span");
    meta.className = "export-row-meta";
    const d = s.savedAt ? new Date(s.savedAt) : null;
    const when =
      d && !Number.isNaN(d.getTime())
        ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
        : "";
    const regs = Array.isArray(s.registros) ? s.registros.length : 0;
    meta.textContent = `${when ? `${when} · ` : ""}${regs} registro(s)`;
    text.append(name, meta);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "export-del";
    del.dataset.del = s.id;
    del.setAttribute("aria-label", `Excluir ${s.nome || "sessão"}`);
    del.title = "Excluir sessão";
    del.textContent = "✕";

    li.append(text, del);
    list.appendChild(li);
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
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
