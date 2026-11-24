// Estado da sessão CronoBase — forma de dados e utilitários puros.
// Nenhum acesso a DOM/armazenamento neste módulo.

export const DEFAULT_CONFIG = {
  nome: "",
  estilo: "Crawl",
  distancia: 50,
  repeticoes: 4,
  descanso: 30,
  series: 1,
  intervalo: 60,
};

export const ESTILOS = ["Crawl", "Costas", "Peito", "Medley", "Livre", "Outro"];
export const DISTANCIAS = [25, 50, 75, 100, 150, 200, 400];

export const APP_VERSION = "0.11.0";

/** Grades dos drums do passo 2 (v0.10.0): reps/séries passo 1,
 *  descanso/intervalo múltiplos de 10. Usado no load e no sync. */
export const CONFIG_GRIDS = {
  repeticoes: { min: 1, max: 20, step: 1, fallback: DEFAULT_CONFIG.repeticoes },
  descanso: { min: 0, max: 600, step: 10, fallback: DEFAULT_CONFIG.descanso },
  series: { min: 1, max: 10, step: 1, fallback: DEFAULT_CONFIG.series },
  intervalo: { min: 0, max: 1800, step: 10, fallback: DEFAULT_CONFIG.intervalo },
};

/** Encaixa os 4 campos numéricos na grade (clamp + arredonda p/ o passo
 *  mais próximo). Valores inválidos voltam ao default. */
export function snapConfig(c) {
  for (const key of Object.keys(CONFIG_GRIDS)) {
    const g = CONFIG_GRIDS[key];
    const n = Number(c[key]);
    if (!Number.isFinite(n)) {
      c[key] = g.fallback;
      continue;
    }
    c[key] = Math.min(g.max, Math.max(g.min, Math.round(n / g.step) * g.step));
  }
}

/** Singleton do estado da sessão (mantido em memória durante a sessão). */
export const state = {
  screen: "config",
  step: 1,
  config: { ...DEFAULT_CONFIG },
  atletas: [],
  selectedAtletas: [],
  raias: [],
  selectedId: null,
  masterRunning: false,
  masterStartedAt: 0,
  masterElapsedMs: 0,
  continuousStartedAt: 0,
  seriesStartedAt: 0,
  sessionStartedAt: null,
  groupSerie: 1,
  staged: [],
  saved: false,
};

let idSeq = 0;
export function uid(prefix = "id") {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createRaia(atleta, lane) {
  return {
    atletaId: atleta.id,
    nome: atleta.nome,
    lane,
    serie: 1,
    rep: 1,
    startedAt: 0,
    waiting: false,
    waitMs: 0,
    waitEndsAt: 0,
    waitKind: "",
    waitLabel: "",
    restAlert: false,
    frozen: false,
    currentSplits: [],
    lastSplitMs: null,
    tempos: [],
    historico: [],
    registroId: null,
    done: false,
  };
}

export function createSession(state, atletas) {
  state.raias = atletas.map((a, i) => createRaia(a, i + 1));
  state.selectedId = state.raias[0]?.atletaId ?? null;
  state.masterRunning = false;
  state.masterStartedAt = 0;
  state.masterElapsedMs = 0;
  state.continuousStartedAt = 0;
  state.seriesStartedAt = 0;
  state.sessionStartedAt = null;
  state.groupSerie = 1;
  state.staged = [];
  state.saved = false;
}

export function resetSessionClocks(state) {
  state.masterRunning = false;
  state.masterStartedAt = 0;
  state.masterElapsedMs = 0;
  state.continuousStartedAt = 0;
  state.seriesStartedAt = 0;
  state.sessionStartedAt = null;
  state.groupSerie = 1;
}

export function resetRaias(state, now = 0) {
  for (const r of state.raias) {
    r.serie = 1;
    r.rep = 1;
    r.startedAt = 0;
    r.waiting = false;
    r.waitMs = 0;
    r.waitEndsAt = 0;
    r.waitKind = "";
    r.waitLabel = "";
    r.restAlert = false;
    r.frozen = false;
    r.currentSplits = [];
    r.lastSplitMs = null;
    r.tempos = [];
    r.historico = [];
    r.registroId = null;
    r.done = false;
  }
  state.selectedId = state.raias[0]?.atletaId ?? null;
  void now;
}

export function selectedRaia(state) {
  return state.raias.find((r) => r.atletaId === state.selectedId) ?? null;
}

export function hasSessionData(state) {
  return Boolean(state.sessionStartedAt) && state.staged.length > 0;
}

export function sessionSummary(state) {
  const c = state.config;
  return `${c.estilo} ${c.distancia}m · ${c.repeticoes} reps · ${c.series} série(s) · descanso ${c.descanso}s${c.series > 1 ? ` · intervalo ${c.intervalo}s` : ""}`;
}
