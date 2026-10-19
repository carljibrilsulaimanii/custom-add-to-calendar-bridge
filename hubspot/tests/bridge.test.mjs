/*
  bridge.test.mjs -- tests for the HubSpot Add to Calendar bridge
  Author:  Jibril Sulaiman
  Date:    2026-10-19
  Run:     npm test   (Node 20+, no dependencies)
  What:    Pulls the raw-block script out of bridge/add-to-calendar-bridge-template.html,
           feeds it the window.ATC_DATA that HubL would print for a record, and runs it
           against a fake page. Checks the UTC stamps for EDT and EST classes, the
           Google / Outlook.com / Yahoo links, the .ics file and its escaping, HTML
           clean-up in the description, both start-time formats crm_object can return,
           the ended-class guard, and the missing-value messages.
  Why:     The bridge runs once per click on a page nobody watches; a broken time or
           a broken file only shows up as a wrong calendar entry for a registrant.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../bridge/add-to-calendar-bridge-template.html', import.meta.url), 'utf8');
const raw = html.split('{% raw %}')[1].split('{% endraw %}')[0];
const script = raw.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

// Example class, Oct 22 2026 7:00 PM EDT = 23:00 UTC.
const CLASS = {
  recordId: '10000000001',
  title: 'Example Class: Investing Basics',
  startMs: String(Date.UTC(2026, 9, 22, 23, 0, 0)),
  startRaw: '2026-10-22T23:00:00Z',
  location: 'https://topic-a.example.com/watch-now',
  description: '<strong>What you will learn:</strong><br><br>- Part one, the basics; &amp; more<br>- Part two'
};

function run(data, { service = '', now = Date.UTC(2026, 9, 19, 12), ua = 'Mozilla/5.0 (Windows NT 10.0)' } = {}) {
  const calls = { replace: [], downloads: [], boxes: [], href: null };
  const body = {
    children: [],
    appendChild(el) { this.children.push(el); if (el.id === 'atc-box') calls.boxes.push(el); },
  };
  function makeEl(tag) {
    return {
      tag, id: '', className: '', textContent: '', children: [], href: '', download: '', type: '',
      appendChild(c) { this.children.push(c); },
      addEventListener() {},
      click() { if (this.tag === 'a' && this.download) calls.downloads.push({ name: this.download, href: this.href }); },
      remove() {},
    };
  }
  const blobs = [];
  const location = {
    search: service ? `?class=topic-a&service=${service}` : '',
    replace(u) { calls.replace.push(u); },
    set href(u) { calls.href = u; },
    get href() { return calls.href; },
  };
  const window = { ATC_DATA: data, location };
  const ctx = {
    window,
    document: {
      readyState: 'complete',
      body,
      createElement: makeEl,
      getElementById: () => null,
      addEventListener() {},
    },
    navigator: { userAgent: ua, maxTouchPoints: 0 },
    console: { log() {} },
    URLSearchParams,
    Blob: class { constructor(parts, opts) { this.text = parts.join(''); this.type = opts.type; blobs.push(this); } },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
    setTimeout: () => 0,
    Date: class extends Date {
      constructor(...a) { if (a.length === 0) super(now); else super(...a); }
      static now() { return now; }
    },
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return { api: window.__ATC_BRIDGE__, calls, blobs, now };
}

test('EDT class: start 23:00 UTC, end 2.5 hours later', () => {
  const { api, now } = run(CLASS);
  const c = api.buildCore(now);
  assert.equal(c.ok, true);
  assert.equal(c.startUtc, '20261022T230000Z');
  assert.equal(c.endUtc, '20261023T013000Z');
});

test('EST class after the November change: 7 PM is 00:00 UTC next day', () => {
  const nov = { ...CLASS, startMs: String(Date.UTC(2026, 10, 13, 0, 0, 0)), startRaw: '' };
  const { api, now } = run(nov);
  const c = api.buildCore(now);
  assert.equal(c.startUtc, '20261113T000000Z');
  assert.equal(c.endUtc, '20261113T023000Z');
});

test('falls back to the ISO string when the millisecond value is missing', () => {
  const { api, now } = run({ ...CLASS, startMs: '' });
  assert.equal(api.buildCore(now).startUtc, '20261022T230000Z');
});

test('google service redirects to a filled Google Calendar event', () => {
  const { calls } = run(CLASS, { service: 'google' });
  assert.equal(calls.replace.length, 1);
  const u = new URL(calls.replace[0]);
  assert.equal(u.hostname, 'calendar.google.com');
  assert.equal(u.searchParams.get('dates'), '20261022T230000Z/20261023T013000Z');
  assert.equal(u.searchParams.get('text'), CLASS.title);
  assert.equal(u.searchParams.get('location'), CLASS.location);
  assert.equal(u.searchParams.get('ctz'), 'America/New_York');
  assert.match(u.searchParams.get('details'), /^What you will learn:\n\n- Part one, the basics; & more\n- Part two$/);
});

test('outlookcom and yahoo open their web calendars', () => {
  const o = new URL(run(CLASS, { service: 'outlookcom' }).calls.replace[0]);
  assert.equal(o.hostname, 'outlook.live.com');
  assert.equal(o.searchParams.get('startdt'), '2026-10-22T23:00:00Z');
  assert.equal(o.searchParams.get('enddt'), '2026-10-23T01:30:00Z');
  assert.equal(o.searchParams.get('subject'), CLASS.title);
  const y = new URL(run(CLASS, { service: 'yahoo' }).calls.replace[0]);
  assert.equal(y.hostname, 'calendar.yahoo.com');
  assert.equal(y.searchParams.get('st'), '20261022T230000Z');
  assert.equal(y.searchParams.get('et'), '20261023T013000Z');
});

test('outlook and ical download one .ics with escaped, folded text', () => {
  for (const service of ['outlook', 'ical', 'apple']) {
    const { calls, blobs } = run(CLASS, { service });
    assert.equal(calls.downloads.length, 1, service);
    assert.equal(calls.downloads[0].name, 'Free-Class.ics');
    const ics = blobs[0].text;
    assert.equal(blobs[0].type, 'text/calendar;charset=utf-8');
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /\r\nDTSTART:20261022T230000Z\r\n/);
    assert.match(ics, /\r\nDTEND:20261023T013000Z\r\n/);
    assert.match(ics, /\r\nUID:free-class-10000000001-1792710000000@example\.com\r\n/);
    const unfolded = ics.replace(/\r\n /g, '');
    assert.match(unfolded, /DESCRIPTION:What you will learn:\\n\\n- Part one\\, the basics\\; & more\\n- Part two/);
    for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, `line too long: ${line}`);
    assert.equal(calls.boxes.length, 1, 'shows the "file is ready" message');
  }
});

test('iPhone gets a data: URL instead of a blob download', () => {
  const { calls } = run(CLASS, { service: 'ical', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
  assert.equal(calls.downloads.length, 0);
  assert.match(calls.href, /^data:text\/calendar;charset=utf-8,BEGIN%3AVCALENDAR/);
});

test('apostrophes and quotes in the title survive', () => {
  const { calls } = run({ ...CLASS, title: "Investor's \"Guide\"" }, { service: 'google' });
  assert.equal(new URL(calls.replace[0]).searchParams.get('text'), "Investor's \"Guide\"");
});

test('empty description uses the watch page link', () => {
  const { api, now } = run({ ...CLASS, description: '' });
  assert.equal(api.buildCore(now).details, CLASS.location);
});

test('a class that has ended is not added', () => {
  const { calls } = run(CLASS, { service: 'google', now: Date.UTC(2026, 9, 23, 2, 0) });
  assert.equal(calls.replace.length, 0);
  assert.equal(calls.boxes.length, 1);
  assert.equal(calls.boxes[0].children[0].textContent, 'This class has ended');
});

test('missing values stop with a reason and redirect nowhere', () => {
  const cases = [
    [{ ...CLASS, recordId: '' }, /No class picked/],
    [{ ...CLASS, title: '' }, /no Class Title/],
    [{ ...CLASS, startMs: '', startRaw: '' }, /no usable 7\. Event Start/],
    [{ ...CLASS, location: '' }, /no Watch Now Page URL/],
  ];
  for (const [data, reason] of cases) {
    const { api, calls, now } = run(data, { service: 'google' });
    assert.equal(calls.replace.length, 0);
    assert.match(api.buildCore(now).reason, reason);
  }
});

test('no service shows a message and does nothing else', () => {
  const { calls } = run(CLASS);
  assert.equal(calls.replace.length, 0);
  assert.equal(calls.downloads.length, 0);
  assert.equal(calls.boxes.length, 1);
});

test('the script holds no HubL delimiters outside the raw block', () => {
  assert.equal(/\{\{|\{%|\{#/.test(script), false);
});
