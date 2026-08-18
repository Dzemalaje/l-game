/**
 * Online smoke test for the SpacetimeDB backend, driven through the real app.
 *
 * Two isolated browser contexts each load the exported web build, claim a username, queue for a
 * casual game, get matched by the server's own matchmaker, and play real turns. Isolated contexts
 * matter: the identity token lives in localStorage, so two plain tabs would be the *same* account.
 *
 * Needs a published module and a running server:
 *   npm run stdb:start        # in another terminal
 *   npm run stdb:publish
 *   npm run build:web
 *   node tools/smoke-online-stdb.mjs
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const BROWSERS = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const PORT = 4174;
const DEBUG_PORT = 9335;
const STDB = process.env.EXPO_PUBLIC_SPACETIMEDB_URL ?? "ws://127.0.0.1:3000";

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
  #socket; #next = 1; #pending = new Map();
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
        const pending = cdp.#pending.get(message.id);
        cdp.#pending.delete(message.id);
        message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
      }
    });
    return cdp;
  }
  send(method, params = {}, sessionId) {
    const id = this.#next++;
    this.#socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "evaluation failed");
    return result.result.value;
  }
  close() { this.#socket.close(); }
}

let passed = 0;
function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  passed += 1;
  console.log(`  ok  ${label}`);
}

const clickText = (cdp, text) => cdp.eval(
  `(() => { const b = [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`,
);
const hasText = (cdp, text) => cdp.eval(`document.body.innerText.includes(${JSON.stringify(text)})`);
const legalTargets = (cdp) => cdp.eval(
  `[...document.querySelectorAll('[data-testid^="board-cell-"]')].filter((n) => n.getAttribute('aria-label')?.includes('legal target')).length`,
);
const clickTarget = (cdp) => cdp.eval(
  `(() => { const c = [...document.querySelectorAll('[data-testid^="board-cell-"]')].find((n) => n.getAttribute('aria-label')?.includes('legal target')); if (!c) return false; c.click(); return true; })()`,
);

const browserPath = BROWSERS.find((candidate) => candidate && existsSync(candidate));
if (!browserPath) {
  console.warn("No Chrome or Edge found; skipping online smoke test.");
  process.exit(0);
}

try {
  const ping = await fetch(`${STDB.replace(/^ws/, "http")}/v1/ping`).then((r) => r.ok).catch(() => false);
  if (!ping) {
    console.warn(`No SpacetimeDB at ${STDB}; skipping online smoke test. Start it with 'npm run stdb:start'.`);
    process.exit(0);
  }
} catch {
  console.warn("Could not reach SpacetimeDB; skipping online smoke test.");
  process.exit(0);
}

const server = spawn(process.execPath, ["node_modules/expo/bin/cli", "serve", "dist", "--port", String(PORT)], { stdio: "ignore", shell: false });
const browser = spawn(browserPath, [
  "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, "--no-first-run", "--no-default-browser-check",
  "--disable-gpu", `--user-data-dir=${process.env.TEMP ?? "/tmp"}/l-game-online-${process.pid}`,
  "--window-size=1280,900", "about:blank",
], { stdio: "ignore", shell: false });

let root;
const tabs = [];
try {
  await waitFor(() => fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok), "web server");
  const version = await waitFor(() => fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json()), "browser debugger");
  root = await Cdp.attach(version.webSocketDebuggerUrl);

  console.log("two players, two isolated browser contexts");
  for (let i = 0; i < 2; i++) {
    // A separate browser context gives each player its own localStorage, and therefore its own
    // identity token. Two plain tabs would share one account.
    const { browserContextId } = await root.send("Target.createBrowserContext");
    const { targetId } = await root.send("Target.createTarget", { url: "about:blank", browserContextId });
    const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
    const cdp = await Cdp.attach(list.find((t) => t.id === targetId).webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
    tabs.push(cdp);
  }

  for (const [i, cdp] of tabs.entries()) {
    await waitFor(() => hasText(cdp, "Play vs CPU"), `tab ${i} home screen`);
  }
  check("the app loads for both players", true);

  for (const [i, cdp] of tabs.entries()) {
    await waitFor(() => cdp.eval(`document.body.innerText.includes("Guest-")`), `tab ${i} guest profile`);
  }
  check("connecting creates a guest profile", true);

  const stamp = Date.now().toString(36).slice(-4);
  const names = [`Ava-${stamp}`, `Ben-${stamp}`];
  for (const [i, cdp] of tabs.entries()) {
    if (!(await clickText(cdp, "Choose a name"))) throw new Error(`tab ${i}: no name button`);
    await waitFor(() => hasText(cdp, "Choose your name"), `tab ${i} name editor`);
    await cdp.eval(`(() => {
      const input = document.querySelector('[aria-label="New username"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(names[i])});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await clickText(cdp, "Save name");
    await waitFor(() => hasText(cdp, names[i]), `tab ${i} named`);
  }
  check("both players claim a username", true);

  const rankedEnabled = await tabs[0].eval(
    `([...document.querySelectorAll('button')].find((n) => n.textContent.trim() === 'Ranked')?.getAttribute('data-disabled') ?? 'false') !== 'true'`,
  );
  check("claiming a name unlocks ranked", rankedEnabled);

  console.log("\nmatchmaking");
  for (const cdp of tabs) await clickText(cdp, "Casual");
  for (const [i, cdp] of tabs.entries()) {
    await waitFor(() => hasText(cdp, "CASUAL MATCH"), `tab ${i} in a match`, 30_000);
  }
  check("the server matches the two players", true);

  for (const [i, cdp] of tabs.entries()) {
    await waitFor(() => cdp.eval(`Boolean(document.querySelector('[data-testid="game-board"]'))`), `tab ${i} board`);
  }
  check("both players see the board", true);

  // Awaited: the seat cards render from the replicated game row, which lands just after the board.
  await waitFor(async () => {
    const text = await tabs[0].eval(`document.body.innerText`);
    return text.includes(names[0]) && text.includes(names[1]);
  }, "both usernames on the seats", 15_000);
  check("both usernames appear on the seats", true);

  console.log("\nplaying");
  let moves = 0;
  for (let round = 0; round < 12 && moves < 4; round++) {
    // Exactly one client should be able to act: the one whose turn the server says it is.
    const actionable = [];
    for (const [i, cdp] of tabs.entries()) {
      if ((await legalTargets(cdp)) > 0) actionable.push(i);
    }
    if (!actionable.length) { await wait(250); continue; }
    check(`only the player on move can act (turn ${moves + 1})`, actionable.length === 1, `tabs: ${actionable}`);

    const cdp = tabs[actionable[0]];
    const other = tabs[1 - actionable[0]];
    const before = await other.eval(`document.body.innerText`);

    for (let step = 0; step < 4; step++) {
      if (!(await clickTarget(cdp))) throw new Error(`no legal target at step ${step + 1}`);
      await wait(60);
    }
    if (!(await clickText(cdp, "Submit L"))) throw new Error("Submit L was not clickable");
    await waitFor(() => hasText(cdp, "Skip disc"), "disc phase");
    await clickText(cdp, "Skip disc");
    moves += 1;

    // The opponent must see the move arrive — that is the subscription replicating the new board.
    await waitFor(async () => (await other.eval(`document.body.innerText`)) !== before, `move ${moves} to replicate`, 15_000);
  }
  check("moves are played through the real UI", moves >= 4, `${moves} moves`);

  const errors = await Promise.all(tabs.map((cdp) => cdp.eval(
    `[...document.querySelectorAll('[role="alert"]')].map((n) => n.textContent).join(' | ')`,
  )));
  check("no rejection was surfaced to either player", errors.every((e) => !/not legal|rejected|not your turn/i.test(e)), errors.join(" || "));

  console.log("\nleaving");
  await clickText(tabs[0], "Leave");
  await waitFor(() => hasText(tabs[0], "Leave and forfeit"), "forfeit confirmation");
  check("leaving a live online match asks for confirmation", true);
  await clickText(tabs[0], "Leave and forfeit");
  await waitFor(() => hasText(tabs[0], "Play vs CPU"), "back home");

  await waitFor(() => hasText(tabs[1], "Return home"), "opponent sees the result", 20_000);
  check("the opponent is given the win", await hasText(tabs[1], "Return home"));

  console.log(`\n${passed} checks passed`);
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  for (const cdp of tabs) cdp.close();
  root?.close();
  browser.kill();
  server.kill();
}
