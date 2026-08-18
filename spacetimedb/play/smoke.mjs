/**
 * Drives the play page through a real match in a real browser.
 *
 * Two headless tabs load the page, each becomes its own player, they queue, get matched by the
 * server, and then play the game out by clicking squares until somebody wins. It follows the same
 * dependency-free Chrome DevTools Protocol approach as tools/smoke-expo-web.mjs.
 *
 * Needs `npm run stdb:start` and a published module. Starts its own copy of the play server.
 *
 *   node spacetimedb/play/smoke.mjs
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4321;
const DEBUG_PORT = 9334;

const BROWSERS = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(probe, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch {
      /* not ready */
    }
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
      cdp.#socket.addEventListener('open', resolve, { once: true });
      cdp.#socket.addEventListener('error', reject, { once: true });
    });
    cdp.#socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && cdp.#pending.has(message.id)) {
        const pending = cdp.#pending.get(message.id);
        cdp.#pending.delete(message.id);
        message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
      }
    });
    return cdp;
  }
  send(method, params = {}) {
    const id = this.#next++;
    this.#socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'browser evaluation failed');
    }
    return result.result.value;
  }
  close() { this.#socket.close(); }
}

let passed = 0;
function check(label, condition, detail = '') {
  if (!condition) throw new Error(`FAIL: ${label}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`  ok  ${label}`);
}

/** Clicks a square by its board index. */
const clickCell = (index) => `document.querySelector('[data-cell="${index}"]').click(), true`;
/** Clicks a control button by its data-act. */
const clickAct = (act) => `(() => { const b = document.querySelector('[data-act="${act}"]'); if (!b || b.disabled) return false; b.click(); return true; })()`;
/** Squares the page is currently highlighting as legal next draws. */
const hints = `[...document.querySelectorAll('.sq.hint')].map(el => Number(el.dataset.cell))`;

const browserPath = BROWSERS.find((candidate) => candidate && existsSync(candidate));
if (!browserPath) {
  console.warn('No Chrome or Edge found; skipping play-page smoke test.');
  process.exit(0);
}

const server = spawn(process.execPath, [join(here, 'serve.mjs'), String(PORT)], { stdio: 'ignore', shell: false });
const browser = spawn(
  browserPath,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `--user-data-dir=${join(process.env.TEMP ?? '/tmp', `l-game-play-smoke-${process.pid}`)}`,
    'about:blank',
  ],
  { stdio: 'ignore', shell: false },
);

let root;
const tabs = [];
try {
  await waitFor(() => fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.ok), 'play server');
  const version = await waitFor(
    () => fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) => r.json()),
    'browser debugger',
  );
  root = await Cdp.attach(version.webSocketDebuggerUrl);

  console.log('two tabs, two players');
  for (let i = 0; i < 2; i++) {
    const { targetId } = await root.send('Target.createTarget', { url: 'about:blank' });
    const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
    const cdp = await Cdp.attach(list.find((t) => t.id === targetId).webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    tabs.push(cdp);
  }

  for (const [i, cdp] of tabs.entries()) {
    await waitFor(() => cdp.eval(`document.getElementById('status').className === 'ok'`), `tab ${i} connected`);
  }
  check('both tabs connect to SpacetimeDB', true);

  const identities = await Promise.all(
    tabs.map((cdp) => cdp.eval(`sessionStorage.getItem('l-game.stdb.token')`)),
  );
  check('each tab is a separate player', identities[0] !== identities[1] && !!identities[0]);

  const names = await Promise.all(
    tabs.map((cdp) => cdp.eval(`document.getElementById('meta').textContent`)),
  );
  check('a guest profile is created and shown', names.every((n) => n.includes('Guest-')), names.join(' | '));

  console.log('\nmatchmaking');
  for (const cdp of tabs) check('queue button is enabled', await cdp.eval(clickAct('casual')));

  for (const [i, cdp] of tabs.entries()) {
    await waitFor(() => cdp.eval(`document.querySelectorAll('.seat').length === 2`), `tab ${i} in a match`);
  }
  check('both tabs are matched into the same game', true);

  const turnText = await tabs[0].eval(`document.getElementById('meta').textContent`);
  check('the match header shows mode and turn', /casual · turn 1/.test(turnText), turnText);

  console.log('\nplaying');
  const turnNumber = (cdp) =>
    cdp.eval(`Number((document.getElementById('meta').textContent.match(/turn (\\d+)/) ?? [])[1] ?? 0)`);

  /** Plays one turn through the UI, optionally relocating a disc. Returns false if it could not. */
  async function playTurn(cdp, moveDisc) {
    for (let step = 0; step < 4; step++) {
      const options = await cdp.eval(hints);
      if (!options?.length) return false;
      await cdp.eval(clickCell(options[0]));
    }
    if (moveDisc) {
      const discs = await cdp.eval(`[...document.querySelectorAll('.sq.disc')].map(el => Number(el.dataset.cell))`);
      if (discs?.length) {
        await cdp.eval(clickCell(discs[0]));
        const targets = await cdp.eval(`[...document.querySelectorAll('.sq.target')].map(el => Number(el.dataset.cell))`);
        if (targets?.length) await cdp.eval(clickCell(targets[0]));
      }
    }
    if (await cdp.eval(clickAct('confirm'))) return true;
    await cdp.eval(clickAct('clear'));
    return false;
  }

  let moves = 0;
  let discMoved = false;
  // A handful of real turns is enough to prove the drawing, disc and submit paths; the backend's
  // own e2e test already plays games out to a natural "no legal moves" win.
  for (let guard = 0; guard < 40 && moves < 6; guard++) {
    let actor = -1;
    for (const [i, cdp] of tabs.entries()) {
      if (await cdp.eval(`!!document.querySelector('[data-act="confirm"]')`)) { actor = i; break; }
    }
    if (actor < 0) { await wait(120); continue; }

    const cdp = tabs[actor];
    const before = await turnNumber(cdp);
    const wantDisc = moves === 0; // exercise the disc phase once
    if (!(await playTurn(cdp, wantDisc))) { await wait(100); continue; }
    moves += 1;
    if (wantDisc) discMoved = true;

    // The opponent's tab must see the same advance — that is the subscription doing its job.
    const other = tabs[1 - actor];
    await waitFor(async () => (await turnNumber(other)) > before, `move ${moves} to reach the other tab`, 10_000);
  }

  check('moves are accepted through the UI', moves >= 6, `${moves} moves played`);
  check('a neutral disc can be relocated through the UI', discMoved);
  const [t0, t1] = await Promise.all(tabs.map(turnNumber));
  check('both tabs agree on the position', t0 === t1 && t0 > 6, `turn ${t0} vs ${t1}`);

  console.log('\nresult');
  // Resign rather than grind to a natural win: this test is about the page, and the backend's e2e
  // test already covers a game ending because a player has no legal moves left.
  check('the resign button is available', await tabs[0].eval(clickAct('resign')));
  for (const [i, cdp] of tabs.entries()) {
    await waitFor(() => cdp.eval(`!!document.querySelector('.result')`), `tab ${i} sees the result`);
  }
  const winner = 1;

  const banners = await Promise.all(
    tabs.map((cdp) => cdp.eval(`document.querySelector('.result')?.textContent ?? ''`)),
  );
  check('both tabs see the result', banners.every((b) => b.length > 0), banners.join(' | '));
  check(
    'exactly one tab is told it won',
    banners.filter((b) => b.includes('You win')).length === 1,
    banners.join(' | '),
  );
  check('the result explains why', banners[0].includes('no legal moves') || banners[0].includes('time') || banners[0].includes('forfeit'), banners[0]);

  const errors = await Promise.all(
    tabs.map((cdp) => cdp.eval(`document.getElementById('notice').textContent`)),
  );
  check('no errors were surfaced to either player', errors.every((e) => !e), errors.join(' | '));

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
