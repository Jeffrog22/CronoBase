// Persistência local (localStorage) — armazenamento de sessões, atletas rápidos,
// configuração e preferências. Sem backend, sem sincronização, sem conta.
//
// Semântica transacional (PRD, regra 10):
//   - Salvar  → flush único; erro NÃO fecha nem apaga o estado pendente.
//   - Cancelar/Descartar → confirmação; descarta SEM gravar nada.
//   - Nunca grava silenciosamente ao cancelar.

const KEY = {
  sessions: "cronobase.sessions.v1",
  atletas: "cronobase.atletas.v1",
  config: "cronobase.config.v1",
  sound: "cronobase.sound.v1",
};

export const MAX_SESSIONS = 50;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  // Lança em caso de quota/serialização — o chamador trata o erro.
  localStorage.setItem(key, JSON.stringify(value));
}

/** Carrega salvas com migração de versão. */
export function loadSessions() {
  const data = readJSON(KEY.sessions, null);
  if (!data) return { version: 1, sessions: [] };
  if (Array.isArray(data)) {
    // Legado: era uma lista simples.
    return { version: 1, sessions: data };
  }
  if (data.version === 1 && Array.isArray(data.sessions)) {
    return { version: 1, sessions: data.sessions };
  }
  return { version: 1, sessions: [] };
}

/**
 * Grava a sessão completa (flush único). Reordena mais antigas fora do limite.
 * Propaga erro de armazenamento — NUNCA apaga o estado pendente.
 */
export function commitSession(session) {
  const data = loadSessions();
  data.sessions.push(session);
  while (data.sessions.length > MAX_SESSIONS) data.sessions.shift();
  writeJSON(KEY.sessions, data);
  return data;
}

export function clearSessions() {
  localStorage.removeItem(KEY.sessions);
}

export function exportSessionsJSON() {
  return JSON.stringify(loadSessions(), null, 2);
}

export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function loadAtletas() {
  const list = readJSON(KEY.atletas, []);
  return Array.isArray(list) ? list : [];
}

export function saveAtletas(list) {
  writeJSON(KEY.atletas, list);
}

export function loadConfig() {
  const cfg = readJSON(KEY.config, null);
  return cfg && typeof cfg === "object" ? cfg : null;
}

export function saveConfig(cfg) {
  writeJSON(KEY.config, cfg);
}

export function loadSound() {
  const v = readJSON(KEY.sound, true);
  return v !== false;
}

export function saveSound(on) {
  writeJSON(KEY.sound, Boolean(on));
}
