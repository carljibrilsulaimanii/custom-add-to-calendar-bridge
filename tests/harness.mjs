/**
 * harness.mjs -- runs bridge/add-to-calendar-bridge.html's script in Node
 * -----------------------------------------------------------------------
 * Author:  Jibril Sulaiman
 * Created: 2026-10-06 (ET)
 * Deploy:  Local only.
 * What:    Pulls the <script> out of the bridge file, fills the custom-value tags
 *          the way GoHighLevel does, and runs it against a fake page: query string,
 *          hidden description div, window.location.assign and file downloads.
 * Why:     The bridge's failures are silent: a class lands an hour off after a DST
 *          change, or a description arrives full of <br> tags. These pin the output.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', 'bridge', 'add-to-calendar-bridge.html');

export function source() { return fs.readFileSync(FILE, 'utf8'); }

// GoHighLevel replaces {{custom_values.x}} before the page is served.
export function render(html, values) {
  return html.replace(/\{\{custom_values\.(\w+)\}\}/g, (m, k) => (k in values ? values[k] : m));
}

export function run(html, { search = '', now = Date.UTC(2026, 1, 1, 12) } = {}) {
  const out = { assigned: null, downloads: [], listeners: {}, logs: [] };
  const desc = html.match(/<div id="atc-description"[^>]*>([\s\S]*?)<\/div>/);
  const script = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];
  const timers = [];
  const blobs = new Map();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(now); }
    static now() { return now; }
  }
  const document = {
    getElementById: (id) => (id === 'atc-description' && desc ? { innerHTML: desc[1] } : null),
    querySelector: () => null,
    addEventListener: (ev, fn) => { (out.listeners[ev] ||= []).push(fn); },
    createElement: () => ({
      style: {},
      click() { out.downloads.push({ name: this.download, text: blobs.get(this.href) }); },
      remove() {},
    }),
    body: { appendChild() {}, prepend() {} },
  };
  const window = {
    location: { search, assign: (u) => { out.assigned = u; } },
    addEventListener: (ev, fn) => { (out.listeners['w:' + ev] ||= []).push(fn); },
  };
  const ctx = {
    window, document, Date: FakeDate, Intl, URLSearchParams,
    console: { log: (...a) => out.logs.push(a.join(' ')) },
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    URL: {
      createObjectURL: (b) => { const u = 'blob:' + blobs.size; blobs.set(u, b.text); return u; },
      revokeObjectURL() {},
    },
    setTimeout: (fn) => { timers.push(fn); },
    // Run an interval's ticks back to back; the bridge stops after MAX_TRIES.
    setInterval: (fn) => {
      const id = { live: true };
      timers.push(() => { for (let i = 0; i < 60 && id.live; i++) fn(); });
      return id;
    },
    clearInterval: (id) => { id.live = false; },
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  (out.listeners.DOMContentLoaded || []).forEach((f) => f());
  while (timers.length) timers.shift()();
  return out;
}
