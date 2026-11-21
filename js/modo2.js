// Regras do Modo 2 (Tempo/Parcial) — portadas do swimbase.js do PBTracker.
// Funções operam sobre o objeto `state` (js/state.js) e devolvem eventos
// para a camada de UI/toque. Persistência é em memória (staging); a gravação
// real acontece apenas em "Salvar" (js/store.js).

import { selectedRaia, resetRaias, resetSessionClocks } from "./state.js";
import { msToDisplay } from "./clock.js";

let hooks = {
  haptic() {},
  blink() {},
  startTicker() {},
  stopTicker() {},
  restEnded() {},
  groupStopped() {},
};

export function setHooks(h) {
  hooks = { ...hooks, ...h };
}

export function startLabel(state) {
  const sel = selectedRaia(state);
  const canSplit =
    state.masterRunning &&
    state.config.distancia >= 50 &&
    sel &&
    !sel.done &&
    !sel.waiting &&
    sel.startedAt > 0;
  return canSplit ? "Split" : "Iniciar";
}

export function canActOnSelected(state) {
  const sel = selectedRaia(state);
  if (!sel || sel.done || sel.waiting || !state.masterRunning || !sel.startedAt) return false;
  return true;
}

/** Inicia/retoma o mestre e arma todas as raias prontas de uma vez. */
export function startMaster(state, now) {
  if (state.masterRunning) return false;
  state.masterRunning = true;
  state.masterStartedAt = now - state.masterElapsedMs;
  if (!state.sessionStartedAt) state.sessionStartedAt = new Date(now).toISOString();
  const someoneSwimming = state.raias.some((r) => !r.done && !r.waiting && r.startedAt > 0);
  if (!someoneSwimming) state.seriesStartedAt = now;
  for (const raia of state.raias) {
    if (!raia.done && !raia.waiting && raia.startedAt === 0) raia.startedAt = now;
  }
  hooks.startTicker();
  return true;
}

/** Pausa explícita. Descansos mantêm o prazo wall-clock (waitEndsAt). */
export function stopMaster(state) {
  if (!state.masterRunning) return false;
  state.masterRunning = false;
  hooks.stopTicker();
  return true;
}

/** Zerar: zera relógios e raias. Staging (dados capturados) fica intocado. */
export function resetMaster(state, now = Date.now()) {
  state.masterRunning = false;
  hooks.stopTicker();
  resetSessionClocks(state);
  resetRaias(state, now);
}

export function selectAtleta(state, id) {
  const raia = state.raias.find((r) => r.atletaId === id);
  if (!raia || raia.done || raia.waiting) return false;
  state.selectedId = id;
  return true;
}

/** Seleção automática round-robin: próxima raia ativa (não concluída, não descansando). */
export function autoSelectNext(state, currentAtletaId = null) {
  const raias = state.raias;
  if (raias.length === 0) {
    state.selectedId = null;
    return null;
  }
  const currentIndex = currentAtletaId
    ? raias.findIndex((r) => r.atletaId === currentAtletaId)
    : raias.findIndex((r) => r.atletaId === state.selectedId);
  let next = null;
  for (let i = 1; i <= raias.length; i++) {
    const idx = (currentIndex + i + raias.length) % raias.length;
    const candidate = raias[idx];
    if (!candidate.done && !candidate.waiting && candidate.startedAt > 0) {
      next = candidate;
      break;
    }
  }
  if (next) {
    state.selectedId = next.atletaId;
    return next;
  }
  state.selectedId = null;
  const anyResting = raias.some((r) => r.waiting);
  const anySwimming = raias.some((r) => !r.done && !r.waiting && r.startedAt > 0);
  if (!anyResting && !anySwimming && state.masterRunning) {
    state.masterRunning = false;
    hooks.stopTicker();
    hooks.groupStopped();
  }
  return null;
}

/** Split (≥50 m): parcial da repetição em andamento. Abaixo de 50 m: no-op. */
export function recordSplit(state, now = Date.now()) {
  if (state.config.distancia < 50) return null;
  if (!canActOnSelected(state)) return null;
  const raia = selectedRaia(state);
  const splitMs = now - raia.startedAt;
  raia.currentSplits.push(splitMs);
  hooks.haptic(40);
  hooks.blink(msToDisplay(splitMs));
  autoSelectNext(state, raia.atletaId);
  return { ms: splitMs, raia };
}

function stageRegistro(state, raia) {
  // Staging em memória: um registro por atleta por série; criado na primeira
  // repetição e atualizado por snapshot a cada nova repetição concluída.
  const c = state.config;
  let rec = state.staged.find((r) => r.id === raia.registroId);
  if (!rec) {
    rec = {
      id: `reg-${raia.atletaId}-${raia.serie}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      atletaId: raia.atletaId,
      nome: raia.nome,
      raia: raia.lane,
      serie: raia.serie,
      estilo: c.estilo,
      distancia: c.distancia,
      repeticoes: c.repeticoes,
      series: c.series,
      descanso: c.descanso,
      intervalo: c.intervalo,
      tempos: [],
      dataHora: new Date().toISOString(),
    };
    raia.registroId = rec.id;
    state.staged.push(rec);
  }
  rec.tempos = [...raia.tempos];
}

/** Registro final da repetição: tempo total, rollover rep/série/done e descanso. */
export function recordFinal(state, now = Date.now()) {
  if (!canActOnSelected(state)) return null;
  const raia = selectedRaia(state);
  const splitMs = now - raia.startedAt;
  raia.tempos.push(msToDisplay(splitMs));
  raia.lastSplitMs = splitMs;
  raia.currentSplits = [];
  hooks.haptic(60);
  hooks.blink(msToDisplay(splitMs));

  let rolloverRegistro = false;
  if (raia.rep < state.config.repeticoes) {
    raia.rep += 1;
    raia.waiting = true;
    raia.waitMs = state.config.descanso * 1000;
    raia.waitEndsAt = now + raia.waitMs;
    raia.waitKind = "descanso";
    raia.restAlert = false;
    raia.frozen = false;
    raia.startedAt = 0;
    raia.waitLabel = `Descanso ${Math.ceil(raia.waitMs / 1000)}s`;
  } else if (raia.serie < state.config.series) {
    raia.serie += 1;
    raia.rep = 1;
    raia.waiting = true;
    raia.waitMs = state.config.intervalo * 1000;
    raia.waitEndsAt = now + raia.waitMs;
    raia.waitKind = "intervalo";
    raia.restAlert = false;
    raia.frozen = false;
    raia.startedAt = 0;
    rolloverRegistro = true;
    raia.waitLabel = `Intervalo ${Math.ceil(raia.waitMs / 1000)}s`;
  } else {
    raia.done = true;
    raia.waitLabel = "Concluído";
    raia.startedAt = 0;
  }

  stageRegistro(state, raia);
  raia.historico.push({ serie: rolloverRegistro ? raia.serie - 1 : raia.serie, tempos: [...raia.tempos] });

  if (rolloverRegistro) {
    raia.tempos = [];
    raia.registroId = null;
  }

  const allFinished = state.raias.every((r) => r.done || r.waiting);
  const anyResting = state.raias.some((r) => r.waiting);
  if (allFinished) {
    state.masterRunning = false;
    if (!anyResting) hooks.stopTicker();
    hooks.groupStopped();
  } else {
    autoSelectNext(state, raia.atletaId);
  }
  return { ms: splitMs, raia, rolloverRegistro, allFinished };
}

function noteGroupSerieRelease(state, raia, now) {
  if (raia.serie > state.groupSerie) {
    state.groupSerie = raia.serie;
    state.seriesStartedAt = now;
  }
}

function releaseRaia(state, raia, now) {
  raia.waiting = false;
  raia.frozen = false;
  raia.restAlert = false;
  raia.waitLabel = "";
  raia.waitMs = 0;
  raia.waitEndsAt = 0;
  raia.startedAt = 0;
  noteGroupSerieRelease(state, raia, now);
}

/** Tick do Modo 2: descanso wall-clock, alerta ≤5 s e sincronização ≤10 s. */
export function tickModo2(state, now = Date.now()) {
  const events = [];
  for (const raia of state.raias) {
    if (raia.done) continue;
    if (raia.waiting) {
      if (raia.frozen) continue;
      raia.waitMs =
        raia.waitEndsAt > 0 ? Math.max(0, raia.waitEndsAt - now) : Math.max(0, raia.waitMs - 30);
      if (raia.waitMs <= 0) {
        const othersResting = state.raias.filter(
          (r) => r.waiting && r !== raia && !r.frozen && r.waitMs > 0
        );
        const shouldSync =
          othersResting.length > 0 && othersResting.some((r) => r.waitMs <= 10000);
        if (shouldSync) {
          raia.frozen = true;
          raia.waitMs = 0;
          raia.restAlert = true;
          raia.waitLabel = "Aguardando...";
          if (state.selectedId === raia.atletaId) state.selectedId = null;
        } else {
          releaseRaia(state, raia, now);
          events.push({ type: "rest-end", raia });
          // Seleção inválida (nula ou apontando para raia inativa) → seleciona
          // a raia recém-liberada ("Pronto"), como no código-fonte.
          const selOk = state.raias.some(
            (r) => r.atletaId === state.selectedId && !r.done && !r.waiting
          );
          if (!selOk) state.selectedId = raia.atletaId;
          // Libera todas as congeladas no mesmo passo.
          for (const other of state.raias) {
            if (other.frozen && other.waiting) {
              releaseRaia(state, other, now);
              events.push({ type: "rest-end", raia: other });
            }
          }
          const anyResting = state.raias.some((r) => r.waiting);
          const anySwimming = state.raias.some(
            (r) => !r.done && !r.waiting && r.startedAt > 0
          );
          if (!anyResting && !anySwimming) {
            // Para o mestre e o ticker em silêncio: aqui as raias liberadas
            // estão "Pronto" (não concluídas), então NÃO é "treino concluído".
            state.masterRunning = false;
            // Nada nadando, nada descansando → sem motivo para seguir tickando.
            hooks.stopTicker();
          }
        }
      } else {
        raia.restAlert = raia.waitMs <= 5000;
        const kind = raia.waitKind === "intervalo" ? "Intervalo" : "Descanso";
        raia.waitLabel = `${kind} ${Math.ceil(raia.waitMs / 1000)}s`;
      }
    }
  }
  return events;
}

/** Reordenação por drag (handle): preserva seleção e renumera raias. */
export function reorderRaias(state, fromId, toId) {
  const from = state.raias.findIndex((r) => r.atletaId === fromId);
  const to = state.raias.findIndex((r) => r.atletaId === toId);
  if (from < 0 || to < 0 || from === to) return false;
  const [moved] = state.raias.splice(from, 1);
  state.raias.splice(to, 0, moved);
  state.raias.forEach((r, i) => {
    r.lane = i + 1;
  });
  return true;
}
