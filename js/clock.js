// Motor temporal — timestamps em Date.now(), nunca contagem acumulada.
// O ticker (~30 ms) apenas pinta a interface; nunca é fonte de verdade.

export const TICK_MS = 30;

/** Formata milissegundos como MM:SS:CC (centésimos via floor). */
export function msToDisplay(ms) {
  const total = Math.max(0, Math.floor(ms / 10));
  const cs = total % 100;
  const totalSec = Math.floor(total / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
}

/** Segundos restantes arredondados para cima (exibição de descanso). */
export function secondsLeft(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export function createTicker(onTick) {
  let id = null;
  return {
    get running() {
      return id !== null;
    },
    start() {
      if (id !== null) return;
      id = setInterval(onTick, TICK_MS);
    },
    stop() {
      if (id === null) return;
      clearInterval(id);
      id = null;
    },
  };
}
