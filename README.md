<!--
  README.md -- custom-add-to-calendar-bridge
  Author:  Jibril Sulaiman
  Date:    2026-10-06
  Lives:   Repo root (GitHub).
  What:    Click-by-click guide to a self-hosted "Add to Calendar" for GoHighLevel
           funnels: one bridge page that builds the calendar entry from custom
           values, and an AddEvent-style dropdown for every button.
  Why:     Replaces a paid add-to-calendar service, and records the GoHighLevel
           traps (time zones, HTML in custom values, merge tags inside code).
-->

# Custom Add to Calendar bridge for GoHighLevel funnels

Two pieces of code give every GoHighLevel (GHL) funnel page an **Add to Calendar** button
without a paid service:

1. **The bridge page** ([`bridge/add-to-calendar-bridge.html`](bridge/add-to-calendar-bridge.html)).
   It's one GHL page, for example `https://events.example.com/add-to-calendar`. It reads
   the event from four **custom values**, converts the Eastern start time to UTC, and then:
   - `?service=google` sends the visitor to Google Calendar's new-event screen, filled in
   - `?service=outlook` or `?service=ical` downloads an `.ics` file
2. **The dropdown** ([`widget/add-to-calendar-dropdown.html`](widget/add-to-calendar-dropdown.html)).
   It turns any GHL button with the class `addtocalendar` into an AddEvent-style menu
   (Apple, Google, Outlook, Outlook.com, Yahoo) whose options link to the bridge.

When the next event is scheduled you change four custom values. Every button on every
page follows.

## Contents

- [Why it exists](#why-it-exists)
- [How it works](#how-it-works)
- [What's in this repo](#whats-in-this-repo)
- [Setup, step by step](#setup-step-by-step)
  - [Step 1. Create the custom values](#step-1-create-the-custom-values)
  - [Step 2. Build the bridge page](#step-2-build-the-bridge-page)
  - [Step 3. Add the dropdown to your pages](#step-3-add-the-dropdown-to-your-pages)
  - [Step 4. Each new event](#step-4-each-new-event)
- [Troubleshooting](#troubleshooting)
- [Running the tests](#running-the-tests)
- [Related repos](#related-repos)

## Why it exists

- **Add-to-calendar services charge by event.** We hit our plan's event limit.
  The bridge has no limit and no fee.
- **Hard-coded calendar links go stale.** A Google Calendar link with the date baked in
  has to be rebuilt on every page, for every event. GHL custom values are shared across
  the whole sub-account, so a page that reads them is always current.
- **Time zones are easy to get wrong.** Calendar links need UTC. A fixed "-5 hours" is
  right half the year. The bridge asks the browser for New York's offset **on the event
  date**, so EST and EDT are both right.
- **Custom values carry formatting.** Descriptions come out of GHL with `<strong>`,
  `<br>` and `&amp;` in them, and a stray apostrophe can end a JavaScript string early.
  The bridge cleans the text and keeps the description out of the JavaScript entirely.

## How it works

```
Funnel page                          Bridge page (/add-to-calendar)            Calendar
┌────────────────────────┐   click   ┌──────────────────────────────────┐
│ [Add to Calendar] ▾    │──────────►│ reads 4 custom values            │
│   Apple      ?service=ical          │ MM-DD-YYYY hh:mm AM/PM (Eastern) │──► Google Calendar
│   Google     ?service=google        │   → UTC start, + 2.5 h end       │      new-event screen
│   Outlook    ?service=outlook       │ cleans description HTML          │──► .ics download
│   Outlook.com ?service=outlook      │ routes on ?service=              │    (Apple, Outlook,
│   Yahoo      ?service=ical          └──────────────────────────────────┘     Yahoo import)
└────────────────────────┘
```

## What's in this repo

| Path | What it is | Goes in |
|---|---|---|
| [`bridge/add-to-calendar-bridge.html`](bridge/add-to-calendar-bridge.html) | The bridge, v1.5.0 | The bridge page's **Header Tracking** (Step 2) |
| [`widget/add-to-calendar-dropdown.html`](widget/add-to-calendar-dropdown.html) | The dropdown, v2.5.0 | **Footer Tracking** of each page with a button (Step 3) |
| [`tests/`](tests/) | Runs the bridge in Node against a fake page | `npm test` |

## Setup, step by step

### Step 1. Create the custom values

About 10 minutes.

**1a.** In GHL go to **Settings → Custom Values** (wording may differ) and create these
four. The keys must match, because the bridge reads them by key.

| Name | Key | Example | Format rules |
|---|---|---|---|
| Event Start Datetime | `{{custom_values.event_start_datetime}}` | `03-18-2026 07:00 PM` | Exactly `MM-DD-YYYY hh:mm AM/PM`, US Eastern time |
| Event Title | `{{custom_values.event_title}}` | `Example Class: Investing Basics` | No straight apostrophes (see ⚠️) |
| Event Location URL | `{{custom_values.event_location_url}}` | `https://www.example.com/watch` | The link attendees join from |
| Event Description | `{{custom_values.event_description}}` | `- <strong>Part one:</strong> ...<br><br> • ...` | Plain text or simple HTML |

⚠️ **Format the start time exactly.** Two-digit month and day, four-digit year, a space,
then `07:00 PM`. Anything else (`3/18/2026`, `19:00`) stops the bridge with
`Start datetime format invalid. Expected MM-DD-YYYY hh:mm AM/PM.` in the browser console.

⚠️ **No straight apostrophe in the title or location.** Both sit inside single-quoted
JavaScript strings (`title: '...'`). `Investor's Guide` ends the string early and the
whole bridge stops running. Use a curly apostrophe (`’`) or leave it out. The
description is safe: v1.5.0 moved it into a hidden `<div>` for exactly this reason.

⚠️ The time is read as **America/New_York**. For another zone, change `EVENT_TIMEZONE`
and `GOOGLE_CTZ` at the top of the bridge script. The end time is the start plus
`CLASS_DURATION_HOURS` (2.5); change that too if your events run longer or shorter.

✅ **Check:** all four values exist with the keys above.

### Step 2. Build the bridge page

About 15 minutes.

**2a.** Go to **Sites → Funnels** and create a funnel just for the bridge. Ours is named
`Add-to-calendar (Don't Delete)`, because an empty-looking funnel invites clean-up and
every calendar button depends on it.

**2b.** Click **Add New Step or Import**, name the step `Add to Calendar`, and set its path
to `add-to-calendar`. The page URL becomes
`https://<your funnel domain>/add-to-calendar`. Write it down; the dropdown links to it.

**2c.** Click **Edit** to open the page builder. Leave the page blank: visitors only see it
for a moment, and only if the redirect is blocked (then the bridge shows its own
**Continue** button).

**2d.** Open **Settings → Tracking Code** (wording may differ). The **Tracking Code**
window has two tabs, **Header Tracking** and **Footer Tracking**. In **Header Tracking**,
paste **all** of [`bridge/add-to-calendar-bridge.html`](bridge/add-to-calendar-bridge.html).
Click **Save**, then save and **Publish** the page.

⚠️ GHL fills in every `{{ ... }}` on the page before serving it, **including inside your
code**. The bridge has a safety check, `s.includes('{{') || s.includes('}}')`, meant to
catch a custom value that didn't render. GHL treats the text between its own braces as
a merge tag, and on our live page the line arrived as `s.includes('{{ ) || s.includes(
}}')`: one odd string that never matches. The redirect still works; you only lose that
check. To keep it, change the line before you paste so no braces sit side by side:

```javascript
return s.includes('{' + '{') || s.includes('}' + '}');
```

**2e.** Test each service in a private window, with your bridge URL:

| Open | Expect |
|---|---|
| `https://<bridge>/add-to-calendar?service=google` | Google Calendar's new-event screen, filled in, at the right local time |
| `https://<bridge>/add-to-calendar?service=outlook` | `Event-Outlook.ics` downloads; opening it adds the event |
| `https://<bridge>/add-to-calendar?service=ical` | `Event-iCal.ics` downloads |
| `https://<bridge>/add-to-calendar` (no `?service=`) | Nothing happens (by design) |

If something is wrong, open the browser console. Every message starts with
`[AddToCal Bridge v1.5.0]`, and a failed run says which value didn't render.

✅ **Check:** the Google event shows the right title, local start time, a 2.5-hour length,
the location link, and the description with line breaks but no HTML.

### Step 3. Add the dropdown to your pages

About 10 minutes per page.

**3a.** Open [`widget/add-to-calendar-dropdown.html`](widget/add-to-calendar-dropdown.html)
and replace all five `https://events.example.com/add-to-calendar` links with your bridge
URL from Step 2b. Keep each link's `?service=` ending.

**3b.** In the page builder, select your **Add to Calendar** button. In its advanced or
style settings, find **Custom Class**, type `addtocalendar` and press Enter ("Press
enter to add a class"). Do this for every Add to Calendar button on the page, including
the mobile copy if your page has separate desktop and mobile sections.

**3c.** Open **Settings → Tracking Code → Footer Tracking**, paste **all** of the edited
widget file, and click **Save**. Save and publish the page.

⚠️ The button's own GHL action (open a popup, go to a URL) still exists underneath. The
widget catches the click first and cancels it. If the widget is ever removed from the
page, that original action comes back, so leave it pointing somewhere sensible.

⚠️ GHL draws buttons late. The widget scans at load, again at 0.5, 1, 2, 3 and 5
seconds, and watches the page for 15 seconds. A button added by a popup that opens later
than that won't get a dropdown.

⚠️ **Outlook.com** and **Yahoo** download the `.ics` file like Outlook and Apple do; there
is no online link for them. People import the file into their web calendar.

**3d.** To open the dropdown straight from an email or text, link to the page with
`#addtocalendar` on the end. The first dropdown on the page opens.

✅ **Check:** on the live page, clicking the button opens the menu above it (or below it
near the top of the screen), each option works as in Step 2e, and Escape or a click
outside closes it. The console shows `[ATC v2.5] Attached to button: ...` for each button.

### Step 4. Each new event

About 2 minutes.

**4a.** Update the four custom values from Step 1. Nothing else changes.

⚠️ Custom values are shared across the sub-account, so the bridge serves **one event at a
time**. Someone who opens an old email after you've switched values gets the new event.
Switch values after the current event ends, not before.

✅ **Check:** repeat Step 2e for the new event.

## Troubleshooting

| Symptom | Check |
|---|---|
| Event is an hour off | The start value isn't Eastern time, or someone hard-coded an offset. The bridge handles EST and EDT itself (Step 1). |
| Google shows `{{custom_values...}}` or nothing happens | A custom value key doesn't match, or the value is empty. Console: `Title did not render.` (Step 1a). |
| Bridge stopped working after a title change | The title has a straight apostrophe (Step 1). |
| Description shows `<strong>` or `&amp;` | The description isn't in the hidden `<div>` at the top of the bridge file. Paste the whole file again (Step 2d). |
| Button opens GHL's popup instead of the menu | The button doesn't have the `addtocalendar` class, or the widget isn't in Footer Tracking (Step 3). |
| Only some buttons get the menu | Each button needs the class, including mobile copies (Step 3b). |
| "Continue" box appears on the bridge page | The browser blocked the redirect or values weren't ready after 10 seconds. Click Continue; check the console for the reason. |

## Running the tests

```bash
npm test
```

Node 20 or newer, no dependencies. The tests pull the script out of the bridge file, fill
the custom values the way GHL does, and run it against a fake page. They cover the Google
link, both `.ics` files and their escaping, EST, EDT and the day after the spring
change, 12 AM and 12 PM, description clean-up, unrendered values, a bad date format, and
the merge-tag trap from Step 2d. The dropdown is plain DOM code and is tested by hand
(Step 3 check).

## Related repos

- [ghl-custom-values-in-hubspot-for-dynamically-updating-funnels](https://github.com/carljibrilsulaimanii/ghl-custom-values-in-hubspot-for-dynamically-updating-funnels): the same "update one record, every page follows" idea, rebuilt in HubSpot.
- [gohighlevel-slicktext-sms-sync-and-campaign-scheduler](https://github.com/carljibrilsulaimanii/gohighlevel-slicktext-sms-sync-and-campaign-scheduler): Eastern-to-UTC scheduling inside GHL workflows.

---

Built by [Jibril Sulaiman](https://github.com/carljibrilsulaimanii).
