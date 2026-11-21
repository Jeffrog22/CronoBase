// Adaptador GameSir X5 Lite (Gamepad API) — portado do app.js do PBTracker.
// Garantias do código-fonte preservadas aqui:
//   - leitura em edge (pressionou agora, não enquanto mantido)
//   - `pressed || value > 0.5` para gatilhos analógicos
//   - debounce por ação (~200 ms)
//   - priming ao conectar/discover (não dispara botão já pressionado)
//   - limpa estado na desconexão; detecta desconexão silenciosa (poll 500 ms)
//   - edge é registrado MESMO com o gate fechado (sem borda fantasma)
//   - contexto relido a cada frame; efeitos passam por rotador nomeado
//   - sem camada de teclado duplicando os mesmos inputs

export const GP = {
  a: 0, b: 1, x: 2, y: 3,
  lb: 4, rb: 5, lt: 6, rt: 7,
  view: 8, menu: 9, l3: 10, r3: 11,
  up: 12, down: 13, left: 14, right: 15,
  home: 16,
};

export const GP_DEBOUNCE_MS = 200;
export const GP_HOME_LONG_MS = 700;
const NO_PAD_POLL_MS = 500;

// Tabela exibida na Ajuda — mapeamento real deste app.
export const GP_MAP = [
  { btn: "LT (6)", fora: "—", chrono: "Iniciar / Split", dialogo: "—" },
  { btn: "RT (7)", fora: "—", chrono: "Parar / finalizar repetição", dialogo: "—" },
  { btn: "A (0)", fora: "Avançar passo da config", chrono: "—", dialogo: "Confirmar" },
  { btn: "B (1)", fora: "Voltar", chrono: "Sair (confirma descarte)", dialogo: "Cancelar" },
  { btn: "X (2)", fora: "—", chrono: "Abrir Resumo (Salvar/Descartar)", dialogo: "Ação primária" },
  { btn: "Y (3)", fora: "Abrir Ajuda", chrono: "Abrir Ajuda", dialogo: "Fechar" },
  { btn: "LB (4)", fora: "Passo anterior", chrono: "—", dialogo: "—" },
  { btn: "RB (5)", fora: "Próximo passo", chrono: "—", dialogo: "—" },
  { btn: "View (8)", fora: "Voltar", chrono: "Sair (confirma descarte)", dialogo: "Fechar" },
  { btn: "Menu (9)", fora: "Abrir Ajuda", chrono: "Abrir Ajuda", dialogo: "Fechar" },
  { btn: "Home (16)", fora: "Curto: início · Longo (≥700 ms): sem ação", chrono: "Curto: início (confirma)", dialogo: "—" },
  { btn: "D-pad / analógicos", fora: "Sem ação", chrono: "Sem ação", dialogo: "Sem ação" },
];

/**
 * @param {object} o
 * @param {() => {screen: string, dialog: string|null}} o.getContext  contexto atual
 * @param {(action: string) => void} o.onAction  roteador de ações nomeadas
 * @param {(status: object) => void} o.onStatus  conexão/diagnóstico
 */
export function initGamepad({ getContext, onAction, onStatus }) {
  const pressed = new Map();
  const lastActionAt = new Map();
  let priming = true;
  let rafId = null;
  let lastPadId = "";
  let homeStart = 0;
  let homeFired = false;
  let lastPollAt = 0;
  let currentPad = null;
  let destroyed = false;

  function status(pad) {
    onStatus({
      connected: Boolean(pad),
      id: pad?.id ?? "",
      mapping: pad?.mapping || "(custom)",
      buttons: pad?.buttons.length ?? 0,
    });
  }

  function findPad(now) {
    const pads = navigator.getGamepads?.() ?? [];
    let pad = null;
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    if (!pad) {
      if (currentPad) {
        currentPad = null;
        pressed.clear();
        homeStart = 0;
        homeFired = false;
        priming = true;
        status(null);
      } else if (now - lastPollAt >= NO_PAD_POLL_MS) {
        lastPollAt = now;
      }
      return null;
    }
    return pad;
  }

  function acionar(action, now) {
    const last = lastActionAt.get(action) ?? -Infinity;
    if (now - last < GP_DEBOUNCE_MS) return;
    lastActionAt.set(action, now);
    onAction(action);
  }

  function loop() {
    if (destroyed) return;
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    const pad = findPad(now);
    if (!pad) return;

    if (pad.id !== lastPadId) {
      lastPadId = pad.id;
      priming = true;
      pressed.clear();
      status(pad);
      if (window.gamepadDebug) {
        console.log("[gamepad] conectado:", pad.id, "mapping:", pad.mapping || "(custom)");
      }
    }
    currentPad = pad;

    // 1) Estado (edge) — SEMPRE para todos os botões, mesmo com o gate
    //    fechado, para não criar bordas fantasma quando o gate abrir.
    const novos = [];
    for (let i = 0; i < pad.buttons.length; i++) {
      const b = pad.buttons[i];
      const down = Boolean(b.pressed || b.value > 0.5); // gatilhos analógicos
      const was = pressed.get(i) === true;
      pressed.set(i, down);
      if (down && !was) {
        novos.push(i);
        if (window.gamepadDebug) {
          console.log(`[gamepad/debug] index=${i} pressionado (value=${b.value.toFixed(2)})`);
        }
      }
    }
    if (priming) {
      priming = false;
      novos.length = 0; // primeiro frame com o controle só sincroniza
    }

    // 2) Contexto relido a cada frame.
    const ctx = getContext();
    const inDialog = Boolean(ctx.dialog);
    const inChrono = !inDialog && ctx.screen === "chrono";

    // 3) Home/Guide (16) — curto <700 ms vs longo ≥700 ms. Longo não tem
    //    ação definida neste app (nenhum modo alternativo seguro); nunca
    //    encerra sessão por long press.
    if (!inDialog && novos.includes(GP.home)) {
      homeStart = now;
      homeFired = false;
    }
    if (homeStart > 0) {
      const held = pressed.get(GP.home);
      if (held && !homeFired && now - homeStart >= GP_HOME_LONG_MS) {
        homeFired = true; // registrado apenas como diagnóstico
        if (window.gamepadDebug) console.log("[gamepad] Home longo (sem ação neste app)");
      }
      if (!held) {
        const dur = now - homeStart;
        homeStart = 0;
        if (!homeFired && dur < GP_HOME_LONG_MS && !inDialog) {
          acionar(inChrono ? "home-chrono" : "home", now);
        }
        homeFired = false;
      }
    }

    // 4) Rotador por contexto.
    if (inDialog) {
      if (novos.includes(GP.a)) acionar("confirm", now);
      if (novos.includes(GP.x)) acionar("primary", now);
      if (novos.includes(GP.b)) acionar("cancel", now);
      if (novos.includes(GP.y)) acionar("cancel", now);
      if (novos.includes(GP.menu)) acionar("cancel", now);
      if (novos.includes(GP.view)) acionar("cancel", now);
      return;
    }

    if (inChrono) {
      if (novos.includes(GP.lt)) acionar("iniciar", now);
      if (novos.includes(GP.rt)) acionar("parar", now);
      if (novos.includes(GP.b)) acionar("sair", now);
      if (novos.includes(GP.view)) acionar("sair", now);
      if (novos.includes(GP.x)) acionar("resumo", now);
      if (novos.includes(GP.y)) acionar("ajuda", now);
      if (novos.includes(GP.menu)) acionar("ajuda", now);
      return;
    }

    // Fora do cronômetro (config/resumo).
    if (ctx.screen === "summary") {
      if (novos.includes(GP.a) || novos.includes(GP.x)) acionar("salvar", now);
      if (novos.includes(GP.b) || novos.includes(GP.lb) || novos.includes(GP.view)) {
        acionar("voltar", now);
      }
      if (novos.includes(GP.y) || novos.includes(GP.menu)) acionar("ajuda", now);
      return;
    }
    if (novos.includes(GP.a) || novos.includes(GP.rb)) acionar("avancar", now);
    if (novos.includes(GP.b) || novos.includes(GP.lb) || novos.includes(GP.view)) {
      acionar("voltar", now);
    }
    if (novos.includes(GP.y) || novos.includes(GP.menu)) acionar("ajuda", now);
  }

  function onConnect() {
    priming = true;
    pressed.clear();
    lastPollAt = 0;
    // status será emitido no próximo frame ao encontrar o pad
  }

  function onDisconnect(ev) {
    const id = ev?.gamepad?.id ?? "";
    if (window.gamepadDebug) console.log("[gamepad] desconectado:", id);
    pressed.clear();
    priming = true;
    homeStart = 0;
    homeFired = false;
    lastPadId = "";
    currentPad = null;
    status(null);
  }

  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onDisconnect);
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    },
  };
}
