<!--
  README.md -- custom-add-to-calendar-bridge
  Author:  Jibril Sulaiman
  Date:    2026-10-06 (updated 2026-10-19: HubSpot version, prerequisites)
  Lives:   Repo root (GitHub).
  What:    Click-by-click guide to a self-hosted "Add to Calendar" in two versions:
           GoHighLevel funnels (custom values) and HubSpot pages (a configuration
           record). Each has a bridge page that builds the calendar entry and an
           AddEvent-style dropdown for every button.
  Why:     Replaces a paid add-to-calendar service, and records each platform's
           traps (time zones, HTML in custom values, merge tags inside code,
           HubSpot's page cache).
-->

# Custom Add to Calendar bridge for GoHighLevel and HubSpot

Two pieces of code give every funnel page an **Add to Calendar** button without a paid
service:

1. **The bridge page.** One page, for example `https://events.example.com/add-to-calendar`,
   reads the event, works out the UTC start and end, and then:
   - `?service=google` sends the visitor to Google Calendar's new-event screen, filled in
   - `?service=outlook` or `?service=ical` downloads an `.ics` file
2. **The dropdown.** It turns each Add to Calendar button into an AddEvent-style menu
   (Apple, Google, Outlook, Outlook.com, Yahoo) whose options link to the bridge.

There are two versions:

| Version | The event lives in | Bridge | Dropdown | Status |
|---|---|---|---|---|
| **GoHighLevel** ([Part 1](#part-1-gohighlevel)) | Four **custom values** | [`bridge/add-to-calendar-bridge.html`](bridge/add-to-calendar-bridge.html) in a funnel page's Header Tracking | [`widget/add-to-calendar-dropdown.html`](widget/add-to-calendar-dropdown.html) in Footer Tracking | Running in production |
| **HubSpot** ([Part 2](#part-2-hubspot)) | One **configuration record** per event topic (a custom object) | [`hubspot/bridge/`](hubspot/bridge/), a page template | [`hubspot/module/`](hubspot/module/), a custom module | **Designed and tested offline, not yet used live** (see the banner in Part 2) |

When the next event is scheduled you change the custom values (GHL) or the record
(HubSpot). Every button on every page follows.

## Contents

- [Why it exists](#why-it-exists)
- [How it works](#how-it-works)
- [What's in this repo](#whats-in-this-repo)
- [Prerequisites and dependencies](#prerequisites-and-dependencies)
- [Part 1: GoHighLevel](#part-1-gohighlevel)
  - [Step 1. Create the custom values](#step-1-create-the-custom-values)
  - [Step 2. Build the bridge page](#step-2-build-the-bridge-page)
  - [Step 3. Add the dropdown to your pages](#step-3-add-the-dropdown-to-your-pages)
  - [Step 4. Each new event](#step-4-each-new-event)
- [Part 2: HubSpot](#part-2-hubspot)
  - [Step 5. Check the configuration record's properties](#step-5-check-the-configuration-records-properties)
  - [Step 6. Create the bridge template](#step-6-create-the-bridge-template)
  - [Step 7. Create and publish the bridge page](#step-7-create-and-publish-the-bridge-page)
  - [Step 8. Fill the description on each record](#step-8-fill-the-description-on-each-record)
  - [Step 9. Test the bridge](#step-9-test-the-bridge)
  - [Step 10. Build or update the calendar button module](#step-10-build-or-update-the-calendar-button-module)
  - [Step 11. Test the live pages](#step-11-test-the-live-pages)
  - [Step 12. Each new event, and new topics](#step-12-each-new-event-and-new-topics)
- [Troubleshooting](#troubleshooting)
- [Limits](#limits)
- [Security](#security)
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

**Why a HubSpot version.** HubSpot has no account-wide custom values. The usual
substitute is a configuration custom object: one record per event topic, which every
page module reads (see
[ghl-custom-values-in-hubspot-for-dynamically-updating-funnels](https://github.com/carljibrilsulaimanii/ghl-custom-values-in-hubspot-for-dynamically-updating-funnels)).
That repo's calendar button still links to a paid AddEvent event, so each new session
means creating an event in AddEvent and pasting its id onto the record. The HubSpot
bridge reads the record itself, so that step goes away. HubSpot also changes a few of
the GHL traps:

- The record's start is a real **date and time** property, stored in UTC. There's no
  `MM-DD-YYYY hh:mm AM/PM` text to parse and no offset to compute.
- HubL escapes each value into the script (`|escapejs`), so an apostrophe in a title
  can't break anything.
- HubL, like GHL, reads `{{ }}` inside your code as a tag. The HubSpot bridge keeps its
  JavaScript inside a `{% raw %}` block, which HubL leaves alone.
- HubSpot pages sit behind a CDN cache of up to 10 hours. The module puts the event's
  start time in every link (`v=`), so after a change each link is a new cache key.

## How it works

**GoHighLevel**

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

**HubSpot**

```
HubSpot page                          Bridge page (/add-to-calendar)                 Calendar
┌──────────────────────────┐  click   ┌───────────────────────────────────┐
│ [Add To Calendar] ▾      │─────────►│ ?id= or ?class= picks the record  │──► Google, Outlook.com,
│  module, one record      │          │ HubL crm_object() reads:          │    Yahoo: new-event
│  Apple       service=ical │          │   Class Title, 7. Event Start,    │    screen, filled in
│  Google      service=google          │   Watch Now Page URL, Description │
│  Outlook     service=outlook         │ end = start + 2.5 h               │──► .ics download
│  Outlook.com service=outlookcom      │ past class? → "has ended"         │    (Apple, Outlook)
│  Yahoo       service=yahoo           └───────────────────────────────────┘
└──────────────────────────┘                  ▲
                                 Free Class Configuration record (one per topic)
```

## What's in this repo

| Path | What it is | Goes in |
|---|---|---|
| [`bridge/`](bridge/) | GHL bridge, v1.5.0 | The bridge page's **Header Tracking** (Step 2) |
| [`widget/`](widget/) | GHL dropdown, v2.5.0 | **Footer Tracking** of each page with a button (Step 3) |
| [`tests/`](tests/) | Runs the GHL bridge in Node against a fake page | `npm test` |
| [`hubspot/bridge/`](hubspot/bridge/) | HubSpot bridge page template, v1.0.0 | Design Manager, a page template (Step 6) |
| [`hubspot/module/free-class-calendar-button.module/`](hubspot/module/free-class-calendar-button.module/) | HubSpot calendar button module, v2.0.0 (HTML, CSS, JS, fields) | Design Manager, a custom module (Step 10) |
| [`hubspot/tests/`](hubspot/tests/) | Runs the HubSpot bridge's script in Node against a fake page | `npm test` |

## Prerequisites and dependencies

You need only the half you're building. Nothing here needs Claude: every step can be
done by hand.

**Accounts, plans and tiers**

| What | Version or plan | Why | Check it's ready |
|---|---|---|---|
| GoHighLevel sub-account (Part 1) | Any plan with **Sites → Funnels** and **Custom Values** | The bridge funnel and the four values | **Settings → Custom Values** opens (wording may differ) |
| HubSpot, any hub at **Enterprise** (Part 2) | Enterprise | Custom objects, for the configuration record | **Settings → Data Management → Objects** lists custom objects |
| HubSpot **Content Hub Professional**, or Marketing Hub Professional with landing pages (Part 2) | Professional or above | Custom page templates, custom modules, the **CRM object** module field, and `crm_object()` in HubL | **Marketing → Files and Templates → Design Tools** opens |
| The configuration object (Part 2) | From [ghl-custom-values-in-hubspot-for-dynamically-updating-funnels](https://github.com/carljibrilsulaimanii/ghl-custom-values-in-hubspot-for-dynamically-updating-funnels), Steps 1 and 4 | The bridge reads its records | One record per topic exists, with **7. Event Start Date and Time** filled |

**Permissions and scopes**

| What | Why | Check it's ready |
|---|---|---|
| GHL: edit funnels and custom values | Steps 1 to 3 | You can save a custom value |
| HubSpot: Design Tools access, publish landing pages, edit the configuration object's properties and records | Steps 5 to 10 | You can open **Design Tools** and **Publish** a landing page |
| No API keys or secrets | Both bridges run in the visitor's browser and read only what the page already prints | n/a |

**Tools**

| What | Version | Why | Check it's ready |
|---|---|---|---|
| A desktop browser and a phone | Any current one | Running the test tables (Steps 2e, 9 and 11), including the iPhone `.ics` sheet | n/a |
| Node.js (optional) | 20 or newer | `npm test` only | `node --version` |

**Claude Code (optional)**

| What | Used for | Can't do | Check it's connected |
|---|---|---|---|
| Claude Code with the HubSpot connector (MCP) | Designing Part 2: reading the configuration records and property types, and checking which live pages carried the old calendar button | Publishing pages outside the portal's primary domain (it can edit those but not publish them), and editing Design Manager modules it didn't create | Ask it to list the configuration object's properties |

## Part 1: GoHighLevel

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
widget file ([`widget/add-to-calendar-dropdown.html`](widget/add-to-calendar-dropdown.html)),
and click **Save**. Save and publish the page.

⚠️ The button's own GHL action (open a popup, go to a URL) still exists underneath. The
widget catches the click first and cancels it. If the widget is ever removed from the
page, that original action comes back, so leave it pointing somewhere sensible.

⚠️ GHL draws buttons late. The widget scans at load, again at 0.5, 1, 2, 3 and 5
seconds, and watches the page for 15 seconds. A button added by a popup that opens later
than that won't get a dropdown.

⚠️ **Outlook.com** and **Yahoo** download the `.ics` file like Outlook and Apple do; there
is no online link for them in the GHL version. People import the file into their web
calendar. (The HubSpot version opens their web calendars; the same links could be
added here.)

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

## Part 2: HubSpot

> **Status: designed and tested offline, not yet used live.** The HubSpot version's code
> passes its 13 automated tests ([Running the tests](#running-the-tests)), but it has not
> yet served real registrants. Menu labels that weren't checked against a screenshot say
> *(wording may differ)*. The GoHighLevel version in Part 1 is the one running in
> production.

The HubSpot version reads the configuration record that your page modules already use.
It has three parts: a page template, one landing page built on it, and a new version of
the **Free Class Calendar Button** module. If you built the custom-values repo, you
already have v1 of that module, which links to AddEvent. Updating it in place switches
every page that carries it, with no page edits.

Do the steps in order. The bridge goes live and gets tested (Step 9) before any button
points at it, so existing buttons keep working until Step 10.

### Step 5. Check the configuration record's properties

About 5 minutes.

**5a.** Go to **Settings → Data Management → Objects → Free Class Configuration →
Properties** (wording may differ). The bridge and the module read these five, by
internal name:

| Label | Internal name | Field type | Used for | If empty |
|---|---|---|---|---|
| Class Title | `class_title` | Single-line text | Event name | The bridge stops with a message |
| 7. Event Start Date and Time | `event_start_date_and_time` | **Date and time picker** | Start; end = start + 2.5 hours | The bridge stops; the module draws no button |
| Watch Now Page URL | `watch_now_page_url` | Single-line text | Location and link: the page attendees join from | Falls back to `watch_now_youtube_link` |
| 1. Watch Now YouTube Link | `watch_now_youtube_link` | Single-line text | Fallback location | The bridge stops if both are empty |
| Add to Calendar Description | `add_to_calendar_description` | Multi-line text | Description | Falls back to the location link |

**5b.** If `watch_now_page_url` or `add_to_calendar_description` doesn't exist, click
**Create property** and add it with the internal name exactly as above. (The
custom-values repo's schema doesn't include these two.)

⚠️ **Use the date and time property, not a text date.** Configuration objects often
carry several fields that look like a class date. Only a **Date and time picker**
property holds the real moment. A **Date picker** stores midnight UTC with no time,
and text fields like `Sep 17th, 2026` can't be used for times at all.

⚠️ **Point the location at your watch page, not the stream link.** The stream link is
often set only days before the event, so calendar entries made earlier would carry an
empty or stale link. The watch page always has the current one.

✅ **Check:** all five internal names exist, and `event_start_date_and_time` is a date
and time property.

### Step 6. Create the bridge template

About 10 minutes.

**6a.** Go to **Marketing > Files and Templates > Design Tools**. Click **File > New
file**, choose **HTML + HubL**, then template type **Page** (wording may differ). Name it
`Free Class Add to Calendar Bridge`.

**6b.** Select all, delete the starter code, and paste in **all** of
[`hubspot/bridge/add-to-calendar-bridge-template.html`](hubspot/bridge/add-to-calendar-bridge-template.html).

**6c.** Edit the three settings near the top of the file:

| Setting | Change it to | Example |
|---|---|---|
| `ATC_OBJECT` | `p<your portal id>_free_class_configurations`, the object's fully qualified name | `p12345678_free_class_configurations` |
| `ATC_RECORDS` | One line per configuration record: `"<record id>": <record id>` | `"10000000001": 10000000001` |
| `ATC_SLUGS` | One short, readable name per record, for links in emails and texts | `"topic-a": "10000000001"` |

⚠️ **Keep each record id twice in `ATC_RECORDS`, once quoted and once bare.** The query
string arrives as text, and `crm_object()` needs a number. HubL's `int` filter can't be
trusted with 11-digit ids, so the template maps the text to a literal number instead.
This list is also the allowlist: the bridge refuses any id that isn't in it.

⚠️ **Don't add `{{`, `{%` or `{#` inside the script.** The JavaScript sits between
`{% raw %}` and `{% endraw %}` so HubL leaves it alone. Anything HubL must fill in goes
in the small `window.ATC_DATA` script above it.

**6d.** Click **Publish changes**.

✅ **Check:** the template appears when you create a landing page (next step).

### Step 7. Create and publish the bridge page

About 10 minutes.

**7a.** Go to **Content > Landing Pages > Create > Landing page** (wording may differ).
Pick your **primary domain** and the template from Step 6.

**7b.** Name the page `Add to Calendar (Don't Delete)`. Every calendar button depends on
it, and an empty-looking page invites clean-up.

**7c.** In **Settings**, set **Page URL** to `add-to-calendar` and **Page title** to
`Add to Calendar`. Under **Advanced**, turn off search indexing and sitemap inclusion
(wording may differ). The template also sends `noindex, nofollow`.

**7d.** Click **Publish**. The page URL is now `https://www.example.com/add-to-calendar`
(your domain). Write it down; the module links to it.

⚠️ **Use the primary domain.** The HubSpot MCP connector can edit pages on any domain
but can only publish them on the portal's primary domain. A bridge on another subdomain
works, but every republish has to be done by hand in the page editor.

✅ **Check:** `https://www.example.com/add-to-calendar?class=topic-a&v=check1` shows
*"Pick a calendar from the class page to add this class."*

### Step 8. Fill the description on each record

About 5 minutes per record.

**8a.** Open each configuration record and paste the event's description into **Add to
Calendar Description**. Plain text with line breaks is best. Simple HTML (`<br>`,
`<strong>`, `<p>`, `<li>`, `&amp;`) is cleaned up. If you're moving off AddEvent, copy
each event's existing description from AddEvent.

**8b.** Click **Save**.

✅ **Check:** the record shows the description with its line breaks.

### Step 9. Test the bridge

About 15 minutes.

Use a private window, and put a **new `v=` value on every link**: HubSpot's CDN can
serve a page from cache for up to 10 hours, and a different query string is a different
cache key. Use a record whose start is in the future. The console prints
`[AddToCal Bridge HS v1.0.0]` lines.

| Open | Expect |
|---|---|
| `https://www.example.com/add-to-calendar?class=topic-a&service=google&v=t1` | Google Calendar's new-event screen with the title, your local start time, a 2.5-hour length, the watch page as location, and the description with line breaks but no HTML |
| `...?class=topic-a&service=outlookcom&v=t2` | Outlook.com's new-event screen, filled in the same way |
| `...?class=topic-a&service=yahoo&v=t3` | Yahoo Calendar's new-event screen, filled in the same way |
| `...?class=topic-a&service=outlook&v=t4` | `Free-Class.ics` downloads and opens in Outlook at the right time. The tab says *"Your calendar file is ready"* |
| `...?class=topic-a&service=ical&v=t5` on an iPhone | Safari's Add to Calendar sheet opens. On a Mac the file downloads and Calendar imports it |
| The same `.ics` added twice | One entry, updated, not two. The UID is fixed per record and start time |
| A record whose event has ended | *"This class has ended"*, and nothing is added |
| `...?class=nope&service=google&v=t6` | *"No class picked..."*, and nothing happens |

**9a. Check how HubL printed the start time.** In the console on any bridge URL, run
`ATC_DATA.startMs`. It should be a 13-digit number matching the record's start. If it's
empty, `ATC_DATA.startRaw` is used instead; check that the times above are still right.

✅ **Check:** every row above matches.

### Step 10. Build or update the calendar button module

About 15 minutes.

**10a. Open or create the module.** In **Design Tools**:
- If you have v1 from the custom-values repo, open **Free Class Calendar Button**. Keep
  its **CRM object** field. Don't delete and re-add it, because that clears the record
  each page has selected.
- Otherwise click **File > New file**, choose **Module**, tick **Landing pages** and
  **Site pages**, choose **Local module**, set **File name** to `Free Class Calendar
  Button`, and click **Create**. Add a **CRM object** field (**Add field**, type `cr`,
  pick **CRM object** under *Selectors*), with **HubL variable name** `crmobject_field`
  and **CRM object type** `Free Class Configuration`.

**10b. Set the CRM object field.**

| Setting | Value |
|---|---|
| **Properties to fetch** | `hs_object_id`, `event_start_date_and_time`, `class_title`. A property that isn't listed here comes back empty |
| **Properties for choice label** | `Class Type`, `Class Title` |

**10c. Add the other two fields**, with the HubL variable names exactly as given. Or
paste all of [`fields.json`](hubspot/module/free-class-calendar-button.module/fields.json)
through **Actions > Edit JSON** (wording may differ), keeping your own CRM object
field's `id`.

| Label | HubL variable name | Type | Default |
|---|---|---|---|
| Button text | `link_text` | Text | `Add To Calendar` |
| Bridge page URL (leave as is) | `bridge_url` | Text | Your bridge URL from Step 7d |

**10d. Paste the code.** In each pane, select all, delete what's there, and paste:
- **module.html (HTML + HubL)** ← all of [`module.html`](hubspot/module/free-class-calendar-button.module/module.html)
- **module.css** ← all of [`module.css`](hubspot/module/free-class-calendar-button.module/module.css)
- **module.js** ← all of [`module.js`](hubspot/module/free-class-calendar-button.module/module.js)

The module settings match [`meta.json`](hubspot/module/free-class-calendar-button.module/meta.json):
landing pages and site pages, not global.

**10e.** Turn on **Make available in templates and pages** and click **Publish
changes**. Updating v1 switches every page that carries it, now.

**10f. New pages only.** Add the module where the button should be, and pick the topic's
record in its **CRM object** field. On pages with separate desktop and mobile sections,
add it to both.

⚠️ **The trigger stays a link (`<a class="free-class-calendar-link">`) directly inside
the module wrapper.** Page CSS written for v1 may target `a.free-class-calendar-link`,
or the wrapper through `:has(> a.free-class-calendar-link)`. A `<button>` or an extra
wrapper would silently drop that styling. Without JavaScript, the link opens Google
Calendar.

⚠️ **HubSpot loads a module's JS once per page,** however many copies of the module the
page has, so the script attaches to every button itself. There's no late-render rescan
like the GHL widget's, because HubSpot renders modules on the server.

✅ **Check:** the module publishes without errors, and the page editor's preview shows
the button.

### Step 11. Test the live pages

About 10 minutes per page. Add a new `?v=` to each page URL.

| Do | Expect |
|---|---|
| Open a page with the button | Same look as before. The console shows `[FC Calendar v2.0] Attached to N button(s)` |
| Click the button | The menu opens above it, or below it near the top of the screen |
| Click each of the 5 options | Each opens the matching Step 9 result in a new tab |
| Press Escape, click the ×, click outside | Each one closes the menu |
| Open the page at phone width | The menu works on the visible copy |
| Open the page with `#addtocalendar` on the end | The first **visible** menu opens on load. The hidden desktop or mobile copy is skipped |
| View the page source | No `addevent.com` links left |

✅ **Check:** every row matches on every page that carries the module.

### Step 12. Each new event, and new topics

About 2 minutes per event.

**12a. Each new event.** Edit the topic's configuration record as you already do (new
start time, title if it changed, description if it changed). No page, module or
template changes.

**12b.** Then open
`https://www.example.com/add-to-calendar?class=<topic>&service=google&v=<anything new>`
and check the date.

⚠️ **Links in emails and texts don't carry the start time.** The module's links include
`v=<start time>`, so they skip the CDN cache after a change. A hand-written
`?class=topic-a&service=google` link doesn't. Send those at least 10 hours after
editing the record, or add any new `v=` value to the link.

**12c. A new topic.** Create its configuration record, then add one line to
`ATC_RECORDS` and one to `ATC_SLUGS` in the bridge template (Step 6c) and click
**Publish changes**. The module needs no change.

✅ **Check:** Step 9's first row works for the new event or topic.

## Troubleshooting

| Symptom | Version | Check |
|---|---|---|
| Event is an hour off | GHL | The start value isn't Eastern time, or someone hard-coded an offset. The bridge handles EST and EDT itself (Step 1). |
| Google shows `{{custom_values...}}` or nothing happens | GHL | A custom value key doesn't match, or the value is empty. Console: `Title did not render.` (Step 1a). |
| Bridge stopped working after a title change | GHL | The title has a straight apostrophe (Step 1). |
| Description shows `<strong>` or `&amp;` | GHL | The description isn't in the hidden `<div>` at the top of the bridge file. Paste the whole file again (Step 2d). |
| Button opens GHL's popup instead of the menu | GHL | The button doesn't have the `addtocalendar` class, or the widget isn't in Footer Tracking (Step 3). |
| Only some buttons get the menu | GHL | Each button needs the class, including mobile copies (Step 3b). |
| "Continue" box appears on the bridge page | GHL | The browser blocked the redirect or values weren't ready after 10 seconds. Click Continue; check the console for the reason. |
| *"No class picked..."* | HubSpot | The link's `class=` or `id=` isn't in `ATC_SLUGS` / `ATC_RECORDS`, or the template wasn't republished after adding it (Step 6c, 12c). |
| *"...no usable 7. Event Start Date and Time"* | HubSpot | The record's start is empty, or HubL printed it in a form the script can't read. Check `ATC_DATA.startMs` and `startRaw` (Step 9a). |
| *"This class has ended"* for an upcoming event | HubSpot | The record still holds the last event's start. Edit the record (Step 12a). |
| The calendar shows last event's date after an edit | HubSpot | The CDN served a cached bridge. Module links carry `v=`; a hand-written link needs a new `v=` (Step 12). |
| No button on the page | HubSpot | The module's record has no start time, or `hs_object_id` / `event_start_date_and_time` isn't in **Properties to fetch** (Step 10b). |
| Button looks different after the update | HubSpot | Page CSS targeted v1's markup. The trigger must stay `a.free-class-calendar-link` directly in the wrapper (Step 10). |
| Clicking the button opens Google Calendar directly | HubSpot | `module.js` isn't in the module's JS pane, or failed. Console should show `[FC Calendar v2.0]` (Step 10d). |
| iPhone shows the `.ics` text instead of the Add to Calendar sheet | HubSpot | Use Safari. Other in-app browsers may not hand `data:text/calendar` to Calendar. |

## Limits

- **One event per variable set or record.** GHL custom values and each HubSpot record
  hold one event at a time. Someone who opens an old link after a change gets the new
  event (or, in HubSpot, *"This class has ended"* if the record hasn't moved on yet).
- **Fixed length.** Both bridges add 2.5 hours. Change `CLASS_DURATION_HOURS` (GHL) or
  `DURATION_MINUTES` (HubSpot) for a different fixed length; there's no per-event length.
- **No reminders.** The `.ics` file has no alarm, so each calendar uses its own default.
- **Outlook.com and Yahoo** open web calendars in the HubSpot version. In the GHL
  version they download the same `.ics` file.
- **HubSpot cache.** Pages can be served from the CDN for up to 10 hours. Module links
  avoid it with `v=`; hand-written links don't (Step 12).

## Security

- Neither version uses an API key, token or secret. Both run in the visitor's browser.
- The HubSpot bridge reads only the five properties listed in Step 5, and only from the
  records listed in `ATC_RECORDS`. Anything in those properties is public on the bridge
  page, so keep private notes out of them.
- `?id=` is stripped to digits and checked against `ATC_RECORDS`; `?class=` is checked
  against `ATC_SLUGS`. Every record value reaches the script through `|escapejs`.
- The bridge page is `noindex, nofollow`.

## Running the tests

```bash
npm test
```

Node 20 or newer, no dependencies. Two suites:

- [`tests/`](tests/) pulls the script out of the GHL bridge, fills the custom values the
  way GHL does, and runs it against a fake page. It covers the Google link, both `.ics`
  files and their escaping, EST, EDT and the day after the spring change, 12 AM and
  12 PM, description clean-up, unrendered values, a bad date format, and the merge-tag
  trap from Step 2d.
- [`hubspot/tests/`](hubspot/tests/) pulls the script out of the HubSpot template's raw
  block, feeds it the `window.ATC_DATA` HubL would print, and runs it against a fake
  page. It covers EDT and EST start times, both start-time formats, the Google,
  Outlook.com and Yahoo links, the `.ics` file's escaping and line folding, the iPhone
  path, apostrophes, the empty-description fallback, the ended-event guard, every
  missing-value message, and that no HubL delimiter sits inside the script.

The dropdowns are plain DOM code and are tested by hand (Steps 3 and 11).

## Related repos

- [ghl-custom-values-in-hubspot-for-dynamically-updating-funnels](https://github.com/carljibrilsulaimanii/ghl-custom-values-in-hubspot-for-dynamically-updating-funnels): the configuration object Part 2 reads, and the v1 calendar button module that Step 10 replaces.
- [gohighlevel-slicktext-sms-sync-and-campaign-scheduler](https://github.com/carljibrilsulaimanii/gohighlevel-slicktext-sms-sync-and-campaign-scheduler): Eastern-to-UTC scheduling inside GHL workflows.

---

Built by [Jibril Sulaiman](https://github.com/carljibrilsulaimanii).
