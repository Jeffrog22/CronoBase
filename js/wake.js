// Wake Lock (mantém a tela acesa durante a sessão) + feedback háptico.
// Ambos são opcionais: ausência/rejeição nunca quebram o cronômetro.

let sentinel = null;
let sessionActive = () => false;

export function setActiveCheck(fn) {
  sessionActive = fn;
}

export async function requestWake() {
  if (!("wakeLock" in navigator)) return false;
  try {
    if (sentinel) return true;
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
    return true;
  } catch {
    // Rejeição (permissão/aba oculta) — ignorar sem quebrar a sessão.
    sentinel = null;
    return false;
  }
}

export function releaseWake() {
  if (!sentinel) return;
  try {
    sentinel.release();
  } catch {
    /* já liberado */
  }
  sentinel = null;
}

// Reaquirir ao voltar ao primeiro plano com sessão ativa.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && sessionActive()) {
    requestWake();
  }
});

export function haptic(pattern) {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* háptico não disponível */
  }
}
