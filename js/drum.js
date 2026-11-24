// Drum / Slot Machine pickers do passo 2 (Séries e descanso).
// Cada wheel envolve um <input type="hidden"> existente com o MESMO id:
// syncConfigFromInputs, os listeners de "change" e renderConfig continuam
// operando sobre o input — o drum é só a camada visual + teclado.
// Sem DOM nos testes de lógica; este módulo só roda no navegador.

const ITEM_H = 40; // px — precisa bater com a altura de .drum-item no CSS

const SPECS = [
  { drumId: "drumRepeticoes", inputId: "cfgRepeticoes", min: 1, max: 20, step: 1, unit: "", one: 1 },
  { drumId: "drumSeries", inputId: "cfgSeries", min: 1, max: 10, step: 1, unit: "", one: 1 },
  { drumId: "drumDescanso", inputId: "cfgDescanso", min: 0, max: 600, step: 10, unit: " s" },
  { drumId: "drumIntervalo", inputId: "cfgIntervalo", min: 0, max: 1800, step: 10, unit: " s" },
];

const drums = [];

function count(spec) {
  return Math.floor((spec.max - spec.min) / spec.step) + 1;
}

function valueAt(spec, i) {
  return spec.min + i * spec.step;
}

function clampIndex(spec, i) {
  return Math.min(count(spec) - 1, Math.max(0, i));
}

function label(spec, v) {
  return spec.one !== undefined && v === spec.one ? "única" : `${v}${spec.unit}`;
}

function highlight(d, i) {
  if (d.centerEl === d.items[i]) return;
  if (d.centerEl) d.centerEl.classList.remove("center");
  d.centerEl = d.items[i];
  d.centerEl.classList.add("center");
  const v = valueAt(d.spec, i);
  d.el.setAttribute("aria-valuenow", String(v));
  d.el.setAttribute("aria-valuetext", label(d.spec, v));
}

function commit(d, v) {
  if (d.input.value === String(v)) return;
  d.input.value = String(v);
  d.input.dispatchEvent(new Event("change"));
}

function onScroll(d) {
  if (d.raf) return;
  d.raf = requestAnimationFrame(() => {
    d.raf = 0;
    // Scroll programático/artefato de layout (visibilidade, snap, renderConfig):
    // só commits de scroll vêm de interação real do usuário (wheel/toque).
    if (!d.user) return;
    const i = clampIndex(d.spec, Math.round(d.scroll.scrollTop / ITEM_H));
    if (i === d.index) return;
    d.index = i;
    highlight(d, i);
    commit(d, valueAt(d.spec, i));
  });
}

function markUser(d) {
  d.user = true;
  clearTimeout(d.idleTimer);
  d.idleTimer = setTimeout(() => {
    d.user = false;
  }, 300);
}

/** Posiciona o wheel no índice do valor atual do input (sem disparar change). */
function syncDrum(d) {
  const raw = Number(d.input.value);
  const v = Number.isFinite(raw) ? raw : d.spec.min;
  const i = clampIndex(d.spec, Math.round((v - d.spec.min) / d.spec.step));
  d.index = i;
  d.user = false; // reposicionamento programático não é interação
  clearTimeout(d.idleTimer);
  if (Math.abs(d.scroll.scrollTop - i * ITEM_H) > 2) d.scroll.scrollTop = i * ITEM_H;
  highlight(d, i);
}

function build(d) {
  const { el, spec } = d;
  const scroll = document.createElement("div");
  scroll.className = "drum-scroll";
  const items = [];
  for (let i = 0; i < count(spec); i++) {
    const item = document.createElement("div");
    item.className = "drum-item";
    item.dataset.i = String(i);
    item.textContent = label(spec, valueAt(spec, i));
    scroll.appendChild(item);
    items.push(item);
  }
  const band = document.createElement("div");
  band.className = "drum-band";
  band.setAttribute("aria-hidden", "true");
  // Banda ANTES do scroll: o texto precisa pintar por cima dela.
  el.append(band, scroll);
  d.scroll = scroll;
  d.items = items;

  scroll.addEventListener(
    "scroll",
    () => {
      // Estende a janela de interação enquanto o arraste/wheel continua.
      if (d.user) markUser(d);
      onScroll(d);
    },
    { passive: true }
  );
  // Interação real arma o commit de scroll (wheel, toque, arraste).
  el.addEventListener("pointerdown", () => markUser(d), { passive: true });
  el.addEventListener("wheel", () => markUser(d), { passive: true });

  el.addEventListener("keydown", (e) => {
    let i = d.index;
    if (e.key === "ArrowUp") i -= 1;
    else if (e.key === "ArrowDown") i += 1;
    else if (e.key === "PageUp") i -= 5;
    else if (e.key === "PageDown") i += 5;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = count(spec) - 1;
    else return;
    e.preventDefault();
    i = clampIndex(spec, i);
    d.index = i;
    d.scroll.scrollTop = i * ITEM_H;
    highlight(d, i);
    commit(d, valueAt(spec, i));
  });
}

/** Cria os 4 wheels do passo 2. Chamar uma vez, após o DOM estar pronto. */
export function initDrums() {
  if (drums.length) return;
  for (const spec of SPECS) {
    const el = document.getElementById(spec.drumId);
    const input = document.getElementById(spec.inputId);
    if (!el || !input) continue;
    const d = { el, input, spec, index: 0, raf: 0, user: false, idleTimer: 0, items: [], centerEl: null, scroll: null };
    build(d);
    drums.push(d);
    syncDrum(d);
  }
}

/** Reposiciona todos os wheels a partir dos inputs (chamado por renderConfig). */
export function syncDrums() {
  for (const d of drums) syncDrum(d);
}
