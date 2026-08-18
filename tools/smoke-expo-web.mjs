// Production-web smoke test. Serves the Expo export and drives Chrome/Edge through the DevTools
// protocol without adding a browser automation dependency.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BROWSERS = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const PORT = 4173;
const DEBUG_PORT = 9333;
const SHOTS = "tools/screenshots";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(probe, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const value = await probe(); if (value) return value; } catch { /* not ready */ }
    await wait(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

class Cdp {
  #socket; #next = 1; #pending = new Map(); events = [];
  static async attach(wsUrl) {
    const cdp = new Cdp();
    cdp.#socket = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      cdp.#socket.addEventListener("open", resolve, { once: true });
      cdp.#socket.addEventListener("error", reject, { once: true });
    });
    cdp.#socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && cdp.#pending.has(message.id)) {
        const pending = cdp.#pending.get(message.id); cdp.#pending.delete(message.id);
        message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
      } else if (message.method) cdp.events.push(message);
    });
    return cdp;
  }
  send(method, params = {}) {
    const id = this.#next++;
    this.#socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "Browser evaluation failed");
    return result.result.value;
  }
  close() { this.#socket.close(); }
}

const browserPath = BROWSERS.find((candidate) => candidate && existsSync(candidate));
if (!browserPath) {
  console.warn("No Chrome or Edge found; skipping browser smoke test.");
  process.exit(0);
}

const server = spawn(process.execPath, ["node_modules/expo/bin/cli", "serve", "dist", "--port", String(PORT)], { stdio: "ignore", shell: false });
const browser = spawn(browserPath, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, "--no-first-run",
  "--no-default-browser-check", "--disable-gpu", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  `--user-data-dir=${join(process.env.TEMP ?? "/tmp", `l-game-expo-smoke-${process.pid}`)}`,
  "--window-size=430,900", "about:blank",
], { stdio: "ignore", shell: false });

let cdp;
let root;
try {
  await waitFor(() => fetch(`http://127.0.0.1:${PORT}/`).then((response) => response.ok), "Expo production server");
  const version = await waitFor(() => fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((response) => response.json()), "browser debugger");
  root = await Cdp.attach(version.webSocketDebuggerUrl);
  const { targetId } = await root.send("Target.createTarget", { url: "about:blank" });
  const targets = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((response) => response.json());
  cdp = await Cdp.attach(targets.find((target) => target.id === targetId).webSocketDebuggerUrl);
  await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 430, height: 900, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Play vs CPU")`), "home screen");
  // A stale but well-formed server must not strip the app of offline play.
  await cdp.eval(`(() => {
    localStorage.setItem("lgame.server", "ws://stale.invalid:3000");
    localStorage.setItem("lgame.authToken", "stale-test-token");
  })()`);
  await cdp.send("Page.reload");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Play vs CPU")`), "home after reload");
const readServerField = () => cdp.eval(`(() => {
    const holder = document.querySelector('[aria-label="SpacetimeDB server URL"]');
    if (!holder) return "";
    const input = holder.tagName === "INPUT" ? holder : holder.querySelector("input");
    return input ? input.value : "";
  })()`);
  // Awaited: the field is populated a tick after the home screen text appears.
  const renderedServerUrl = await waitFor(readServerField, "the server URL field");

  // Regression: a malformed stored address used to reach the SpacetimeDB SDK untouched and fail
  // inside `new URL(...)`, leaving the app permanently offline with a browser-specific error about
  // a string the player never typed in that form. It must now be discarded and rewritten on load.
  await cdp.eval(`(() => {
    localStorage.setItem("lgame.server", "http//:127.0.0.1:3000");
  })()`);
  await cdp.send("Page.reload");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Play vs CPU")`), "home after malformed server");
  const healed = await cdp.eval(`localStorage.getItem("lgame.server") ?? ""`);
  if (!/^wss?:\/\//.test(healed)) {
    throw new Error(`A malformed stored server was not repaired: ${healed || "(empty)"}`);
  }
  const healedField = await waitFor(
    async () => {
      const value = await readServerField();
      return /^wss?:\/\//.test(value) ? value : null;
    },
    "the repaired address to render",
  );
  if (!/^wss?:\/\//.test(healedField)) {
    throw new Error(`The repaired address did not render: ${healedField || "(empty)"}`);
  }

  // The two blocks above deliberately point the app at an unreachable host and hand it a rejected
  // token, so the failed requests they provoke are the expected result, not a regression. Drop them
  // before the run-wide console-error assertion below.
  cdp.events.length = 0;

  mkdirSync(SHOTS, { recursive: true });
  const mobile = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(SHOTS, "expo-home-mobile.png"), Buffer.from(mobile.data, "base64"));

  const clickText = (text) => cdp.eval(`(() => { const button = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === ${JSON.stringify(text)}); if (!button) return false; button.click(); return true; })()`);
  if (!await clickText("Play vs CPU")) throw new Error("Play vs CPU button was not clickable");
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]'))`), "game board");
  const matchShot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(SHOTS, "expo-match-mobile.png"), Buffer.from(matchShot.data, "base64"));
  for (let step = 0; step < 4; step++) {
    const clicked = await cdp.eval(`(() => { const cell = [...document.querySelectorAll('[data-testid^="board-cell-"]')].find((node) => node.getAttribute('aria-label')?.includes('legal target')); if (!cell) return false; cell.click(); return true; })()`);
    if (!clicked) throw new Error(`No legal board target at L step ${step + 1}`);
    await wait(80);
  }
  await waitFor(() => cdp.eval(`([...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Submit L')?.getAttribute('data-disabled') ?? 'false') !== 'true'`), "enabled Submit L");
  await clickText("Submit L");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Skip disc")`), "neutral-disc phase");
  await clickText("Skip disc");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Return home") || (document.body.innerText.includes("Tap through") && !document.body.innerText.includes("CPU is"))`), "completed CPU turn", 8_000);
  let cpuFinished = await cdp.eval(`document.body.innerText.includes("Return home")`);
  for (let turn = 1; turn < 30 && !cpuFinished; turn++) {
    for (let step = 0; step < 4; step++) {
      const pick = turn * 11 + step * 5;
      const target = await cdp.eval(`(() => { const cells = [...document.querySelectorAll('[data-testid^="board-cell-"]')].filter((node) => node.getAttribute('aria-label')?.includes('legal target')); const cell = cells[${pick} % Math.max(1, cells.length)]; if (!cell) return false; cell.click(); return true; })()`);
      if (!target) break;
      await wait(8);
    }
    if (!await clickText("Submit L")) throw new Error(`Could not submit CPU match turn ${turn + 1}`);
    await wait(8);
    if (!await clickText("Skip disc")) throw new Error(`Could not skip disc on CPU match turn ${turn + 1}`);
    await waitFor(() => cdp.eval(`document.body.innerText.includes("Return home") || (document.body.innerText.includes("Tap through") && !document.body.innerText.includes("CPU is"))`), `CPU response ${turn + 1}`, 8_000);
    cpuFinished = await cdp.eval(`document.body.innerText.includes("Return home")`);
  }
  if (!cpuFinished) throw new Error("vs CPU did not reach a result within 30 player turns");
  if (!await clickText("Play again")) throw new Error("vs CPU Play again action was not clickable");
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]')) && !document.body.innerText.includes("Return home")`), "restarted CPU match");
  await clickText("Leave");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Pass & Play")`), "return home");

  // Regression: completed CPU/local matches used to freeze behind an inert parent. Drive a full
  // deterministic Pass & Play game, then verify the result action starts a fresh match.
  await clickText("Pass & Play");
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]'))`), "Pass & Play board");
  let finished = false;
  for (let turn = 0; turn < 120 && !finished; turn++) {
    for (let step = 0; step < 4; step++) {
      const pick = turn * 7 + step * 3;
      const target = await cdp.eval(`(() => { const cells = [...document.querySelectorAll('[data-testid^="board-cell-"]')].filter((node) => node.getAttribute('aria-label')?.includes('legal target')); const cell = cells[${pick} % Math.max(1, cells.length)]; if (!cell) return false; cell.click(); return true; })()`);
      if (!target) break;
      await wait(8);
    }
    if (await cdp.eval(`document.body.innerText.includes("Return home")`)) { finished = true; break; }
    if (!await clickText("Submit L")) throw new Error(`Could not submit Pass & Play turn ${turn + 1}`);
    await wait(8);
    if (!await clickText("Skip disc")) throw new Error(`Could not skip disc on Pass & Play turn ${turn + 1}`);
    await wait(8);
    finished = await cdp.eval(`document.body.innerText.includes("Return home")`);
  }
  if (!finished) throw new Error("Pass & Play did not reach a result within 120 deterministic turns");
  if (!await clickText("Play again")) throw new Error("Completed-match Play again action was not clickable");
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]')) && !document.body.innerText.includes("Return home")`), "restarted Pass & Play match");
  await clickText("Leave");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Play vs CPU")`), "home after completed match");

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  const desktop = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(SHOTS, "expo-home-desktop.png"), Buffer.from(desktop.data, "base64"));

  const errors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown"
    || (event.method === "Log.entryAdded" && ["error", "assert"].includes(event.params?.entry?.level)));
  if (errors.length) throw new Error(`Browser console reported ${errors.length} error(s): ${JSON.stringify(errors.slice(0, 3))}`);
  console.log("Expo web smoke passed: responsive render, completed CPU/local results, replay, and leave flow.");
} finally {
  cdp?.close();
  root?.close();
  browser.kill();
  server.kill();
}
