/**
 * bridge.test.mjs -- tests for the add-to-calendar bridge
 * --------------------------------------------------------
 * Author:  Jibril Sulaiman
 * Created: 2026-10-06 (ET)
 * Deploy:  Local only. Run with `npm test` (Node 20+).
 * What:    Google Calendar link, .ics files, Eastern-to-UTC across DST, description
 *          clean-up, unrendered custom values and the GoHighLevel tag-rendering trap.
 * Why:     A calendar entry an hour off, or a description full of HTML, is only
 *          noticed by the attendee.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { source, render, run } from './harness.mjs';

const VALUES = {
  event_start_datetime: '03-18-2026 07:00 PM',
  event_title: 'Example Class: Investing Basics',
  event_location_url: 'https://www.example.com/watch',
  event_description: '- <strong>Part one:</strong> What it is.<br><br> • <strong>Part two &amp; three:</strong> How to start.',
};
const page = (v = {}) => render(source(), { ...VALUES, ...v });
const dates = (out) => new URL(out.assigned).searchParams.get('dates');

test('google: redirects to an event-edit link with UTC times and the Eastern zone', () => {
  const out = run(page(), { search: '?service=google' });
  const u = new URL(out.assigned);
  assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/u/0/r/eventedit');
  assert.equal(u.searchParams.get('dates'), '20260318T230000Z/20260319T013000Z'); // 7pm EDT, 2.5 hours
  assert.equal(u.searchParams.get('text'), 'Example Class: Investing Basics');
  assert.equal(u.searchParams.get('location'), 'https://www.example.com/watch');
  assert.equal(u.searchParams.get('ctz'), 'America/New_York');
  assert.equal(u.searchParams.get('details'), '- Part one: What it is.\n\n• Part two & three: How to start.');
});

test('winter dates use EST (UTC-5)', () => {
  assert.equal(dates(run(page({ event_start_datetime: '02-12-2026 07:00 PM' }), { search: '?service=google' })),
    '20260213T000000Z/20260213T023000Z');
});

test('the day after the spring change already uses EDT', () => {
  assert.equal(dates(run(page({ event_start_datetime: '03-09-2026 12:00 AM' }), { search: '?service=google' })),
    '20260309T040000Z/20260309T063000Z');
});

test('12 PM is noon, not midnight', () => {
  assert.equal(dates(run(page({ event_start_datetime: '11-05-2026 12:00 PM' }), { search: '?service=google' })),
    '20261105T170000Z/20261105T193000Z');
});

test('outlook and ical download a valid .ics with escaped text', () => {
  for (const [svc, name] of [['outlook', 'Event-Outlook.ics'], ['ical', 'Event-iCal.ics']]) {
    const out = run(page({ event_title: 'A, B; C' }), { search: '?service=' + svc });
    assert.equal(out.assigned, null);
    assert.equal(out.downloads.length, 1);
    assert.equal(out.downloads[0].name, name);
    const lines = out.downloads[0].text.split('\r\n');
    assert.equal(lines[0], 'BEGIN:VCALENDAR');
    assert.equal(lines.at(-1), 'END:VCALENDAR');
    assert.ok(lines.includes('DTSTART:20260318T230000Z'));
    assert.ok(lines.includes('DTEND:20260319T013000Z'));
    assert.ok(lines.includes('SUMMARY:A\\, B\\; C'));
    assert.ok(lines.includes('DESCRIPTION:- Part one: What it is.\\n\\n• Part two & three: How to start.'));
  }
});

test('no ?service: the bridge does nothing', () => {
  const out = run(page(), { search: '' });
  assert.equal(out.assigned, null);
  assert.equal(out.downloads.length, 0);
});

test('an unrendered custom value stops the redirect and logs why', () => {
  const { event_title, ...rest } = VALUES;
  const out = run(render(source(), rest), { search: '?service=google' });
  assert.equal(out.assigned, null);
  assert.ok(out.logs.some((l) => /Auto-run failed: Title did not render/.test(l)));
});

test('a start time in the wrong format is refused', () => {
  const out = run(page({ event_start_datetime: '2026-03-18 19:00' }), { search: '?service=google' });
  assert.equal(out.assigned, null);
  assert.ok(out.logs.some((l) => /Expected MM-DD-YYYY hh:mm AM\/PM/.test(l)));
});

test('GoHighLevel trap: the merge-tag renderer also rewrites the {{ }} check itself', () => {
  // GHL treats any {{ ... }} on the page, code included, as a merge tag. On the live
  // page this check was served as `s.includes('{{ ) || s.includes( }}')`, one odd
  // string, so it could never match. Pin the source so the README warning stays true.
  assert.ok(source().includes("return s.includes('{{') || s.includes('}}');"));
});
