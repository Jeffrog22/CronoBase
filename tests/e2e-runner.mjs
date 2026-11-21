// Runner E2E: gera _e2e.html a partir de index.html, serve a raiz em Node,
// roda Edge/Chrome headless, extrai o bloco SMOKE-RESULT e reporta o exit code.
// Uso: npm run test:e2e
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = normalize(join(fileURLToPath(import.meta.url), "..", ".."));
const OUT_HTML = join(ROOT, "_e2e.html");
const PORT = 8123;
const VIRTUAL_TIME_BUDGET = 25000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function findBrowser() {
  const candidates = [
    process.env.CRONOBASE_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function generateHtml() {
  const index = readFileSync(join(ROOT, "index.html"), "utf8");
  const marker = '<script type="module" src="js/main.js"></script>';
  if (!index.includes(marker)) {
    throw new Error(`index.html: marcador não encontrado: ${marker}`);
  }
  const injected = index.replace(
    marker,
    `${marker}\n    <script type="module" src="tests/e2e-checks.js"></script>`
  );
  writeFileSync(OUT_HTML, injected, "utf8");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
        const filePath = normalize(join(ROOT, rel));
        if (!filePath.startsWith(ROOT)) {
          res.writeHead(403).end("forbidden");
          return;
        }
        const body = readFileSync(filePath);
        res.writeHead(200, {
          "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function runBrowser(browser) {
  const profileDir = join(process.env.TEMP || ROOT, `cronobase-e2e-${process.pid}`);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    "--enable-logging=stderr",
    "--v=0",
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET}`,
    "--dump-dom",
    `http://127.0.0.1:${PORT}/_e2e.html`,
  ];
  // IMPORTANTE: spawn assíncrono — o servidor HTTP precisa do event loop livre
  // para responder o Edge enquanto ele carrega a página.
  return new Promise((resolve) => {
    const child = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      console.error("  [runner] timeout de 120s — navegador encerrado.");
      resolve({ dom: stdout, stderr, timedOut: true });
    }, 120000);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.error("  [runner] spawn error:", err.message);
      resolve({ dom: "", stderr, timedOut: false });
    });
    child.on("close", (status, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (status !== 0) {
        console.error(`  [runner] browser exit status=${status} signal=${signal} stdout=${stdout.length}B`);
      }
      if (stdout.length === 0) {
        console.error("  [runner] stderr tail:\n" + stderr.split(/\r?\n/).slice(-10).join("\n"));
      }
      for (const line of stderr.split(/\r?\n/)) {
        if (/CONSOLE/.test(line) && !/vibrate|ProtocolLaunch|Tracking Prevention|gapi|google|doubleclick|escolhasegura|iframe|Content Security|deprecated|ipm\]/.test(line)) {
          console.log("  [console]", line.replace(/^.*CONSOLE:\d+\]\s*/, ""));
        }
      }
      resolve({ dom: stdout, stderr, timedOut: false });
    });
  });
}

function extractResults(dom) {
  const m = dom.match(/<pre id="SMOKE-RESULT">([\s\S]*?)<\/pre>/);
  if (!m) return null;
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error("Navegador headless não encontrado (Edge/Chrome). Defina CRONOBASE_BROWSER.");
    process.exit(2);
  }

  generateHtml();
  const server = await startServer();
  let exitCode = 1;
  try {
    const { dom } = await runBrowser(browser);
    const lines = extractResults(dom);
    if (!lines) {
      console.error("FAIL: bloco SMOKE-RESULT não encontrado no DOM.");
      console.error("Domínio servido, bytes:", dom.length);
      exitCode = 1;
    } else {
      let pass = 0;
      let fail = 0;
      for (const line of lines) {
        console.log(line);
        if (line.startsWith("PASS")) pass++;
        else if (line.startsWith("FAIL")) fail++;
      }
      console.log(`\n${pass} PASS / ${fail} FAIL`);
      exitCode = fail === 0 ? 0 : 1;
    }
  } finally {
    server.close();
    try {
      unlinkSync(OUT_HTML);
    } catch {
      /* já removido */
    }
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Runner E2E falhou:", err);
  process.exit(1);
});
