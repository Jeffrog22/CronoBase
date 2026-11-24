// Temas visuais — tokens CSS na raiz via data-theme.
// Trocar tema durante a sessão NÃO altera relógios, tempos nem seleções.

const KEY = "cronobase.theme";
export const THEMES = new Set(["normal", "night", "pool"]);
export const THEME_OPTIONS = [
  { id: "normal", label: "Normal" },
  { id: "night", label: "Noturna" },
  { id: "pool", label: "Solar" },
];

export function applyTheme(theme) {
  const safe = THEMES.has(theme) ? theme : "normal";
  document.documentElement.dataset.theme = safe;
  try {
    localStorage.setItem(KEY, safe);
  } catch {
    /* preferência descartável em modo privado */
  }
  return safe;
}

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return THEMES.has(t) ? t : "normal";
  } catch {
    return "normal";
  }
}

export function nextTheme(current) {
  const ids = THEME_OPTIONS.map((t) => t.id);
  const i = ids.indexOf(current);
  return ids[(i + 1) % ids.length];
}
