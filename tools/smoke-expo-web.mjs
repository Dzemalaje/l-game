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
  // Regression: a malformed stored address used to reach the SpacetimeDB SDK untouched and fail
  // inside `new URL(...)`, leaving the app permanently offline with a browser-specific error about
  // a string the player never typed in that form. It must now be discarded and rewritten on load.
  //
  // Checked through localStorage rather than an input: the Connection settings panel is gone, so
  // the stored value is the only remaining observable, and it is the one that actually matters.
  await cdp.eval(`(() => {
    localStorage.setItem("lgame.server", "http//:127.0.0.1:3000");
  })()`);
  await cdp.send("Page.reload");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Play vs CPU")`), "home after malformed server");
  const healed = await waitFor(
    async () => {
      const value = await cdp.eval(`localStorage.getItem("lgame.server") ?? ""`);
      return /^wss?:\/\//.test(value) ? value : null;
    },
    "the stored server address to be repaired",
  );
  if (!/^wss?:\/\//.test(healed)) {
    throw new Error(`A malformed stored server was not repaired: ${healed || "(empty)"}`);
  }

  // The two blocks above deliberately point the app at an unreachable host and hand it a rejected
  // token, so the failed requests they provoke are the expected result, not a regression. Drop them
  // before the run-wide console-error assertion below.
  cdp.events.length = 0;

  mkdirSync(SHOTS, { recursive: true });
  const mobile = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(SHOTS, "expo-home-mobile.png"), Buffer.from(mobile.data, "base64"));

  const clickText = (text) => cdp.eval(`(() => { const button = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === ${JSON.stringify(text)}); if (!button) return false; button.click(); return true; })()`);
  const hasText = (text) => cdp.eval(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const clickTarget = (pick) => cdp.eval(`(() => {
    const cells = [...document.querySelectorAll('[data-testid^="board-cell-"]')].filter((node) => node.getAttribute('aria-label')?.includes('legal target'));
    if (!cells.length) return false;
    cells[${pick} % cells.length].click();
    return true;
  })()`);

  /**
   * Walks four highlighted squares into a complete L.
   *
   * Picking a legal square at each step is not enough on its own: some paths run out of
   * continuations before the fourth square, which leaves the shape unfinished. A human sees that
   * and backs out, so the test does too - Clear, then try a different route. Reaching the disc
   * phase is the only proof the L actually landed.
   */
  /** Waits, but reports what the screen actually said when it does not happen. */
  const waitForScreen = async (predicate, label, timeout) => {
    try {
      return await waitFor(predicate, label, timeout);
    } catch {
      const text = await cdp.eval(`document.body.innerText.replace(/\s+/g, " ").slice(0, 300)`);
      throw new Error(`Timed out waiting for ${label}. Screen read: ${JSON.stringify(text)}`);
    }
  };

  /** Centre of a board square, in CSS pixels. */
  const cellCentre = (x, y) => cdp.eval(`(() => {
    const node = document.querySelector('[data-testid="board-cell-${x}-${y}"]');
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
  })()`);

  /** The squares currently offered as legal continuations, as [x, y] pairs. */
  const legalCells = () => cdp.eval(`(() => [...document.querySelectorAll('[data-testid^="board-cell-"]')]
    .filter((node) => node.getAttribute('aria-label')?.includes('legal target'))
    .map((node) => node.getAttribute('data-testid').replace('board-cell-', '').split('-').map(Number)))()`);

  // A real pointer drag: press, travel, lift. Held open across awaits so the page can be queried
  // mid-gesture, which is how the drag can follow the rules instead of guessing a path up front.
  const press = async (x, y) => cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  const moveTo = async (x, y) => {
    // Two samples per square, one short of the centre and one on it, so the crossing is unambiguous.
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x - 3, y: y - 3, button: "left", buttons: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
    await wait(40);
  };
  const release = async (x, y) => {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    await wait(60);
  };

  /**
   * Draws an L with a single continuous drag, asking the board what is legal between samples the
   * way a player reads the highlights as they go. Returns true only if the shape actually landed.
   */
  const dragL = async () => {
    const legal = await legalCells();
    if (!legal.length) return false;
    const start = await cellCentre(legal[0][0], legal[0][1]);
    if (!start) return false;
    await press(start.x, start.y);
    await moveTo(start.x, start.y);

    const used = [legal[0]];
    for (let step = 0; step < 3; step++) {
      const options = await legalCells();
      const next = options.find((cell) => !used.some(([x, y]) => x === cell[0] && y === cell[1]));
      if (!next) break;
      const point = await cellCentre(next[0], next[1]);
      if (!point) break;
      used.push(next);
      await moveTo(point.x, point.y);
      if (await hasText("End turn")) break;
    }
    const last = await cellCentre(used[used.length - 1][0], used[used.length - 1][1]);
    await release(last?.x ?? start.x, last?.y ?? start.y);
    return hasText("End turn");
  };

  /** Drags a neutral disc onto a legal empty square, again as one gesture. */
  const dragDisc = async () => {
    const discs = await cdp.eval(`(() => [...document.querySelectorAll('[data-testid^="board-cell-"]')]
      .filter((node) => /neutral disc/.test(node.getAttribute('aria-label') ?? ''))
      .map((node) => node.getAttribute('data-testid').replace('board-cell-', '').split('-').map(Number)))()`);
    if (!discs.length) return false;
    const from = await cellCentre(discs[0][0], discs[0][1]);
    if (!from) return false;
    await press(from.x, from.y);
    await moveTo(from.x, from.y);

    // Legal squares only appear once the disc is actually held, which the first crossing does.
    const neighbours = await cdp.eval(`(() => [...document.querySelectorAll('[data-testid^="board-cell-"]')]
      .map((node) => node.getAttribute('data-testid').replace('board-cell-', '').split('-').map(Number)))()`);
    const probe = neighbours.find(([x, y]) => x !== discs[0][0] || y !== discs[0][1]);
    const probePoint = await cellCentre(probe[0], probe[1]);
    await moveTo(probePoint.x, probePoint.y);

    const destinations = await legalCells();
    if (!destinations.length) { await release(probePoint.x, probePoint.y); return false; }
    const target = await cellCentre(destinations[0][0], destinations[0][1]);
    await moveTo(target.x, target.y);
    await release(target.x, target.y);
    return cdp.eval(`(() => [...document.querySelectorAll('[data-testid^="board-cell-"]')]
      .some((node) => /selected destination/.test(node.getAttribute('aria-label') ?? '')))()`);
  };

  const drawL = async (seed) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      if (await hasText("Clear")) await clickText("Clear");
      for (let step = 0; step < 4; step++) {
        if (!await clickTarget(seed + attempt * 3 + step * 5)) break;
        await wait(20);
      }
      if (await hasText("End turn")) return true;
      if (await hasText("Return home")) return true;
    }
    return false;
  };

  if (!await clickText("Play vs CPU")) throw new Error("Play vs CPU button was not clickable");
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]'))`), "game board");
  const matchShot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(SHOTS, "expo-match-mobile.png"), Buffer.from(matchShot.data, "base64"));
  // The animation layer finds board shapes by attribute rather than by ref. React Native SVG
  // forwarding those attributes through to the DOM is the assumption the whole thing rests on, so
  // it is asserted rather than trusted.
  const tagged = await cdp.eval(`(() => ({
    targets: document.querySelectorAll('[data-lg="target"]').length,
    discs: document.querySelectorAll('[data-lg="disc"]').length,
    pieces: document.querySelectorAll('[data-lg="piece"]').length,
  }))()`);
  if (!tagged.targets || tagged.discs !== 2 || !tagged.pieces) {
    throw new Error(`Board shapes are not tagged for animation: ${JSON.stringify(tagged)}`);
  }

  if (!await drawL(0)) throw new Error("Could not complete an L on the first turn");
  // Motion writes inline styles as it animates; their presence is what proves it ran.
  const animated = await cdp.eval(`(() => [...document.querySelectorAll('[data-lg]')]
    .some((node) => /transform|opacity|scale/.test(node.getAttribute('style') ?? '')))()`);
  if (!animated) throw new Error("Motion did not apply any inline style to the board shapes");
  await waitFor(() => hasText("End turn"), "disc phase after a completed L");
  if (!await clickText("End turn")) throw new Error("End turn was not clickable");
  await waitForScreen(() => cdp.eval(`document.body.innerText.includes("Return home") || (document.body.innerText.includes("Drag through") && !document.body.innerText.includes("CPU is"))`), "completed CPU turn", 8_000);
  let cpuFinished = await cdp.eval(`document.body.innerText.includes("Return home")`);
  for (let turn = 1; turn < 30 && !cpuFinished; turn++) {
    if (!await drawL(turn * 11)) throw new Error(`Could not complete an L on CPU match turn ${turn + 1}`);
    if (await cdp.eval(`document.body.innerText.includes("Return home")`)) { cpuFinished = true; break; }
    if (!await clickText("End turn")) throw new Error(`Could not end CPU match turn ${turn + 1}`);
    await waitForScreen(() => cdp.eval(`document.body.innerText.includes("Return home") || (document.body.innerText.includes("Drag through") && !document.body.innerText.includes("CPU is"))`), `CPU response ${turn + 1}`, 8_000);
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

  // Drawing an L by dragging, and moving a disc by dragging it, are the two gestures the board
  // exists for. Pass & Play is where they can be checked without a CPU clock racing the assertions.
  if (!await dragL()) throw new Error("Dragging across the board did not place an L");
  if (!await dragDisc()) throw new Error("Dragging a neutral disc did not move it to a legal square");
  if (!await clickText("End turn")) throw new Error("End turn after the dragged move was not clickable");

  // The run below is deterministic from the opening position, so the dragged turn gets its own
  // match rather than shifting every position after it.
  await clickText("Leave");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Play vs CPU")`), "home after the drag checks");
  await clickText("Pass & Play");
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]'))`), "fresh Pass & Play board");

  let finished = false;
  for (let turn = 0; turn < 120 && !finished; turn++) {
    if (!await drawL(turn * 7)) throw new Error(`Could not complete an L on Pass & Play turn ${turn + 1}`);
    if (await cdp.eval(`document.body.innerText.includes("Return home")`)) { finished = true; break; }
    if (!await clickText("End turn")) throw new Error(`Could not end Pass & Play turn ${turn + 1}`);
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

  // The match is one fixed-width column on desktop too, so it is worth seeing rather than assuming.
  await clickText("Play vs CPU");
  await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]'))`), "desktop match board");
  await wait(300);
  const desktopMatch = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(SHOTS, "expo-match-desktop.png"), Buffer.from(desktopMatch.data, "base64"));
  await clickText("Leave");
  await waitFor(() => cdp.eval(`document.body.innerText.includes("Play vs CPU")`), "home after the desktop match");

  // This run is deliberately offline, so the client failing to open a websocket to a SpacetimeDB
  // that is not running is the expected condition, not a defect. Everything else still counts.
  const offlineConnect = (event) => event.params?.entry?.source === "network"
    && /ERR_CONNECTION_REFUSED|ERR_CONNECTION_TIMED_OUT/.test(event.params?.entry?.text ?? "")
    && /\/v1\/identity|\/v1\/database\//.test(event.params?.entry?.url ?? "");
  const errors = cdp.events.filter((event) => (event.method === "Runtime.exceptionThrown"
    || (event.method === "Log.entryAdded" && ["error", "assert"].includes(event.params?.entry?.level)))
    && !offlineConnect(event));
  if (errors.length) throw new Error(`Browser console reported ${errors.length} error(s): ${JSON.stringify(errors.slice(0, 3))}`);
  console.log("Expo web smoke passed: responsive render, completed CPU/local results, replay, and leave flow.");
} finally {
  cdp?.close();
  root?.close();
  browser.kill();
  server.kill();
}
