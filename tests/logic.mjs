// Teste de lógica do motor (Modo 2) — roda em Node, sem DOM.
// Uso: npm run test:logic
import { state, DEFAULT_CONFIG, createSession } from "../js/state.js";
import {
  setHooks, startMaster, stopMaster, resetMaster, recordSplit, recordFinal,
  selectAtleta, autoSelectNext, tickModo2, startLabel, reorderRaias,
} from "../js/modo2.js";
import { msToDisplay } from "../js/clock.js";
import { buildXlsx, crc32 } from "../js/xlsx.js";

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log("  PASS", msg);
  else {
    failures++;
    console.error("  FAIL", msg);
  }
}

setHooks({ haptic() {}, blink() {}, startTicker() {}, stopTicker() {}, groupStopped() {}, restEnded() {} });

// Setup
Object.assign(state, {
  screen: "chrono",
  config: { ...DEFAULT_CONFIG, distancia: 50, repeticoes: 2, series: 2, descanso: 30, intervalo: 60 },
  raias: [], selectedId: null, masterRunning: false, masterStartedAt: 0,
  masterElapsedMs: 0, continuousStartedAt: 0, seriesStartedAt: 0,
  sessionStartedAt: null, groupSerie: 1, staged: [],
});
createSession(state, [{ id: "a1", nome: "Ana" }, { id: "a2", nome: "Bia" }]);
ok(state.raias.length === 2 && state.raias[0].lane === 1, "buildRaias cria 2 raias");
ok(state.selectedId === "a1", "seleção inicial = primeira raia");

// msToDisplay
ok(msToDisplay(0) === "00:00:00", "msToDisplay(0)");
ok(msToDisplay(1234567) === "20:34:56", "msToDisplay(1234567) = 20:34:56 (floor em centésimos)");
ok(msToDisplay(61500) === "01:01:50", "msToDisplay(61500)");

// Split < 50m
state.config.distancia = 25;
startMaster(state, Date.now());
ok(state.masterRunning, "startMaster liga o mestre");
ok(state.raias.every((r) => r.startedAt > 0), "startMaster arma todas as raias prontas");
const split25 = recordSplit(state, Date.now() + 1000);
ok(split25 === null, "dist<50: split NÃO registra");
ok(state.raias[0].currentSplits.length === 0, "dist<50: sem parciais");
ok(startLabel(state) !== "Split", "dist<50: botão exibe Iniciar");

// Split >= 50m
state.config.distancia = 50;
resetMaster(state, Date.now());
createSession(state, [{ id: "a1", nome: "Ana" }, { id: "a2", nome: "Bia" }]);
const t0 = Date.now();
startMaster(state, t0);
const sp = recordSplit(state, t0 + 5000);
ok(sp && sp.ms === 5000, "split>=50 registra 5000ms");
ok(state.raias[0].currentSplits.length === 1, "parcial na lista");
ok(state.selectedId === "a2", "autoSelect avançou para próxima raia ativa");

// Final da rep (rep 1 → descanso wall-clock)
const rf = recordFinal(state, t0 + 12000);
ok(rf && rf.ms === 12000, "final usa startedAt da raia selecionada (bia)");
ok(state.raias[1].waiting && state.raias[1].waitKind === "descanso", "rep1 → descanso");
ok(state.raias[1].waitEndsAt - Date.now() > 25000, "waitEndsAt wall-clock (~30s)");
ok(state.raias[1].rep === 2, "rep incrementou para 2");
ok(state.staged.length === 1, "staging criou 1 registro");
ok(state.staged[0].tempos.length === 1, "staging tem 1 tempo");

// Tick: descanso não decremente fixo; usa waitEndsAt
state.raias[1].waitEndsAt = Date.now() + 30000;
state.raias[1].waitMs = 30000;
const before = 30000;
tickModo2(state, Date.now() + 50);
ok(state.raias[1].waitMs === 29950, "tick reduz waitMs via waitEndsAt (wall-clock)");

// Descanso vencido + outro descansando ≤10s → freeze (Aguardando)
state.raias[1].waitEndsAt = Date.now() - 1;
state.raias[1].waitMs = 1;
// Ana em descanso com 5s restantes (deve sincronizar a liberação de Bia)
state.raias[0].waiting = true;
state.raias[0].waitKind = "descanso";
state.raias[0].waitMs = 5000;
state.raias[0].waitEndsAt = Date.now() + 5000;
const ev1 = tickModo2(state, Date.now());
ok(state.raias[1].frozen && state.raias[1].waitLabel === "Aguardando...", "≤10s: Bia congela aguardando");
ok(state.raias[0].waitMs <= 5000, "Ana segue contando");

// Ana termina descanso → libera as duas no mesmo passo
state.raias[0].waitEndsAt = Date.now() - 1;
const ev2 = tickModo2(state, Date.now());
ok(!state.raias[0].waiting && !state.raias[1].waiting, "liberação em conjunto (≤10s)");
ok(ev2.some((e) => e.type === "rest-end" && e.raia.atletaId === "a1"), "evento rest-end emitido");
ok(state.raias[0].startedAt === 0 && state.raias[1].startedAt === 0, "release ≠ start (Pronto)");
ok(state.raias[0].atletaId === state.selectedId, "seleção válida após liberação");

// Série rollover
state.raias[0].rep = 2; // última rep da série 1
state.raias[0].waiting = false;
state.raias[0].startedAt = Date.now();
state.masterRunning = true;
const before2 = state.raias[0].serie;
const rf2 = recordFinal(state, Date.now());
ok(state.raias[0].serie === before2 + 1 && state.raias[0].rep === 1, "série rollover → série+1, rep=1");
ok(state.raias[0].waitKind === "intervalo", "intervalo entre séries");
ok(state.raias[0].registroId === null, "registroId zerado no rollover");
ok(state.staged.length >= 2, "novo registro staged para a série 2");
const s2 = state.staged.find((r) => r.atletaId === "a1" && r.serie === 2);
ok(s2 && s2.tempos.length === 1, "snapshot da série anterior preservado antes do clear");

// Última rep → done + todos finalizados
state.raias[0].waiting = false;
state.raias[0].rep = state.config.repeticoes; // última rep da última série
state.raias[0].serie = state.config.series;
state.raias[0].startedAt = Date.now();
state.raias[1].waiting = false;
state.raias[1].done = true;
state.raias[1].startedAt = 0;
state.selectedId = "a1"; // elegível para gravar
const rf3 = recordFinal(state, Date.now());
ok(state.raias[0].done, "última rep conclui a raia");
ok(rf3.allFinished, "allFinished quando todas concluídas/descansando");
ok(state.masterRunning === false, "mestre para ao concluir grupo");

// Zerar preserva staging
ok(state.staged.length > 0, "staging existe antes do Zerar");
resetMaster(state, Date.now());
ok(state.staged.length > 0, "resetMaster NÃO descarta staging");
ok(state.raias[0].tempos.length === 0 && state.raias[0].serie === 1, "reset zera raias");

// Pausa
createSession(state, [{ id: "a1", nome: "Ana" }]);
startMaster(state, Date.now());
ok(stopMaster(state), "stopMaster pausa");
ok(!state.masterRunning, "mestre desligado na pausa");

// Reordenação preserva seleção e renumera
createSession(state, [{ id: "a1", nome: "Ana" }, { id: "a2", nome: "Bia" }, { id: "a3", nome: "Caio" }]);
state.selectedId = "a3";
reorderRaias(state, "a3", "a1");
ok(state.raias[0].atletaId === "a3" && state.raias.map((r) => r.lane).join() === "1,2,3", "drag renumera 1..N");
ok(state.selectedId === "a3", "seleção preservada após drag");

// Seleção ignora concluída/descansando
createSession(state, [{ id: "a1", nome: "Ana" }, { id: "a2", nome: "Bia" }]);
state.raias[0].done = true;
ok(selectAtleta(state, "a1") === false, "select ignora raia concluída");
ok(selectAtleta(state, "a2") === true, "select aceita raia ativa");

// autoSelectNext: round-robin só entre ativas
state.raias[0].done = false;
state.raias[0].startedAt = Date.now();
state.raias[1].startedAt = Date.now();
autoSelectNext(state, "a1");
ok(state.selectedId === "a2", "autoSelect vai para a2");
autoSelectNext(state, "a2");
ok(state.selectedId === "a1", "autoSelect volta para a1 (round-robin)");

// ---------------- XLSX (v0.9.0) ----------------
function includesAscii(bytes, str) {
  const needle = new TextEncoder().encode(str);
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}
function countMatches(bytes, str) {
  const needle = new TextEncoder().encode(str);
  let n = 0;
  for (let i = 0; i <= bytes.length - needle.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) n++;
  }
  return n;
}

const crc = crc32(new TextEncoder().encode("123456789"));
ok(crc === 0xcbf43926, `crc32("123456789") = 0x${crc.toString(16)}`);

const sample = buildXlsx([
  {
    id: "s1",
    nome: 'Treino <A> & "B"',
    savedAt: "2026-11-22T12:00:00.000Z",
    registros: [
      {
        nome: "Ana",
        raia: 1,
        serie: 1,
        estilo: "Crawl",
        distancia: 50,
        repeticoes: 4,
        series: 1,
        descanso: 30,
        intervalo: 60,
        tempos: ["00:01:00", "00:01:10"],
        dataHora: "2026-11-22T12:00:00.000Z",
      },
    ],
  },
]);
ok(sample[0] === 0x50 && sample[1] === 0x4b && sample[2] === 0x03 && sample[3] === 0x04, "xlsx começa com PK\\x03\\x04");
ok(includesAscii(sample, "xl/workbook.xml"), "xlsx contém xl/workbook.xml");
ok(includesAscii(sample, "xl/worksheets/sheet1.xml"), "xlsx contém sheet1");
ok(includesAscii(sample, "&lt;A&gt;"), "escape XML de < e >");
ok(includesAscii(sample, "&amp;"), "escape XML de &");
ok(includesAscii(sample, "Atleta"), "cabeçalho da planilha presente");
ok(countMatches(sample, "<row ") === 2, `1 registro → 2 rows (header+dado) [rows=${countMatches(sample, "<row ")}]`);

const empty = buildXlsx([]);
ok(empty[0] === 0x50 && empty[1] === 0x4b, "xlsx sem sessões ainda é ZIP válido");
ok(includesAscii(empty, "sheetData"), "planilha vazia tem sheetData");
ok(countMatches(empty, "<row ") === 1, "planilha vazia só tem header");

console.log(failures === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
