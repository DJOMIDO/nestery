# Nestery roadmap

Nestery is a personal tools app. Each tool is built in small phases; this file
tracks what is done, what is planned next, and ideas that were considered.

## Tasks

**Done**
- Personal task list with due dates, reminders, priority and status
- Tags (replaced projects), tag and date filters, side panel for editing
- Dashboard: welcome summary with quick add, today, reminders, at a glance
  (tasks, notes, calendar), up next (7-day agenda), recent notes, recent
  activity across tasks, notes and events
- Board view: To do / In progress / Waiting / Done columns, drag a card to
  change its status; quick add at the top of each open column

## Notes

**Done**
- Phase 1: notes with a rich-text editor (Tiptap), autosave, pin, search,
  delete with undo; note activity and a New Note action on the dashboard
- Phase 2: checklists, tables, links, highlight, a bubble menu for selected
  text and a block type menu
- Phase 3: Markdown paste, per-note Markdown source view, `.md` import and export

**Planned**
- **Attachments**: file and image uploads, images shown inline, drag-and-drop
  and paste to upload. Storage: Neon Object Storage (S3-compatible, lives in
  the same Neon project and branches with the database); first check that it
  can be enabled on the existing project. Also needs an attachments table, a
  size limit, and cleanup when a note is deleted.
- **Integration**: tags on notes, shared with tasks (and counted in the
  dashboard's At a glance); server-side full-text search once there are
  enough notes to need it.
- **Slash menu**: type `/` on an empty line to insert headings, lists,
  checklists, tables and so on.

## Calendar

**Done**
- Phase 1: month view with your own events (timed, all-day, multi-day), task
  due dates, reminders and public holidays; a day agenda; a Today card and a
  New Event action on the dashboard
- Date & time settings: date format (English US/UK, French, Chinese), 12/24-hour
  time, week start (Monday/Sunday) and holiday countries (up to 3), applied
  across the whole app
- Phase 2a: week view with a time grid (overlapping events side by side, a
  now line, click an empty slot to add an event); drag events and tasks to
  another day, drag events to another time (15-minute steps), and drag an
  event's bottom edge to change when it ends
- Phase 2b: repeating events (daily, weekly on chosen days, monthly, yearly;
  every N; until a date or a number of times), stored as RRULEs; edit or
  delete one occurrence or the whole series; dragging an occurrence moves
  just that one. Not yet: "this and following occurrences".
- Phase 3a: subscribe to calendar feeds (.ics / webcal links such as an ADE
  timetable, Google or Outlook), shown read-only in their own color next to
  your events and on the Today card; switch each on or off; refreshed
  hourly or on demand. The server fetches feeds with SSRF protection
  (public hosts only, redirects re-checked, time and size limits).
- Phase 3b: import `.ics` files as your own events (supported repeat rules
  kept, edited occurrences attached to their series, re-imports skipped by
  UID, a choice for unsupported rules); a private feed link (secret token,
  can be replaced or turned off) so other calendar apps can subscribe to
  your events and open tasks' due dates

**Planned**
- "This and following occurrences" when editing a repeating event.

## Account

**Done**
- Email and password sign-up and sign-in (Better Auth, self-hosted; data in
  the app's own tables); GitHub and Google sign-in, each offered only when
  its OAuth credentials are configured
- Rate limits on sign-in, sign-up, password change and account deletion,
  stored in the database; 8-character minimum for new passwords
- Settings > Account: change name and password, connect or disconnect
  GitHub and Google, see and sign out devices, delete the account and all
  its data
- Emails over SMTP (a Gmail app password works without a domain): forgot /
  reset password, email verification required to sign in when SMTP is set
  up (existing accounts were marked verified), changing the email address
  (approved from the old address, confirmed from the new one)

## Weather

Ported from [vitemeteo](https://github.com/DJOMIDO/vitemeteo). Data from
Open-Meteo (no API key, free), fetched on the server.

**Done**
- Phase 1: today's weather in the dashboard's Today card (current
  conditions in the title row, high and low, a line when rain or snow is
  likely later today); the place is chosen in Settings > Weather

**Planned**
- °C / °F choice
- Phase 2: weather on the calendar, per day in the month and week views and
  for events and trips that have a place

## Assistant

An agent that works across Nestery's tools rather than AI features bolted
onto each one, e.g. "I fly to Paris on Friday: what's the weather there, add
a packing task for Thursday and list my visa notes".

**Done**
- v1: a chat panel (sidebar ✦ or ⌘J, on every page) with tool use over the
  user's own data: list tasks, list events (including subscribed
  calendars), search and read notes, weather for any place up to 14 days.
  Creating a task or event and changing a task are proposals the user
  confirms in the panel; nothing is deleted. Conversations are not saved.
- Bring your own key: Settings > Assistant takes the user's API key
  (checked, stored encrypted with AES-GCM) and model. The app owner's key
  only serves allow-listed emails, with a daily limit. The agent loop talks
  to providers through a small adapter interface (Anthropic first).
- OpenAI-compatible providers: OpenAI, Google Gemini, OpenRouter, or any
  base URL (DeepSeek, Groq, ...). Custom URLs are checked like calendar
  feeds (public hosts only, no redirects); local servers such as LM Studio
  work while developing. Streamed tool calls are parsed leniently, and
  reasoning written as <think>…</think> is hidden.
- Replies: Markdown rendered (no raw HTML), links to the tasks, notes and
  events mentioned (in-app deep links), dates in the user's format, in the
  language of the user's latest message. The assistant states what it can
  and can't do, and an empty reply from a small model is retried once.

**Planned**
- Notes RAG: embed notes with pgvector in the same Neon database, answers
  cite the notes they come from and say so when nothing relevant is found.
  Reuses what was learned in [Archivist](https://github.com/DJOMIDO/archivist)
  (chunking, citations, evaluation); Archivist stays a separate learning
  project, where new agent ideas are tried first.
- Each new tool (Travel, attachments, ...) adds its own tools to the agent.

## Travel

Flights and train journeys, rewritten from
[noname-app](https://github.com/DJOMIDO/noname-app) (Vue, Neon Auth) into
Nestery's stack. Its airport, airline and currency data and its CSV import
can be reused; existing journeys move over through a CSV export and import.

**Done**
- Phase 1: a Travel page (sidebar) with upcoming and past flights and train
  journeys, filtered by kind; add, edit and delete them, with the usual
  fields up front and the rest under "More details". Times are local at
  each end; flights take each end's time zone from the airport list.
  Airport and airline codes are suggested from ~7,900 airports
  (mwgg/Airports) and ~900 airlines (Wikidata); unknown codes are kept.
  CSV import with the old tracker's columns; journeys already logged (same
  flight or train on the same day) are skipped.

**Planned**
- Phase 2: journeys on the calendar and in the dashboard's Up next, with the
  destination's weather
- Phase 3: statistics and a route map

## Suggested order

1. ~~Weather card~~ (done): the agent's first outside tool
2. ~~Assistant v1~~ and other providers (done)
3. Notes RAG (after note attachments if attached PDFs should be searchable)
4. Travel (phase 1 done)
5. Cookbook

## Ideas

Tools worth borrowing from Nextcloud, in rough order of priority:

- **Bookmarks**: save links with the page title and icon fetched
  automatically, organized with the shared tags.
- **Cookbook**: recipes with ingredients, steps and serving scaling; import
  from recipe sites that publish structured recipe data. Can borrow from
  [EtuCuisto](https://github.com/DJOMIDO/EtuCuisto) (same stack: pantry,
  kitchen profile and AI recipe suggestions), which stays a separate public
  app.
- **Budget**: personal income and expense tracking by category; possibly
  splitting costs within a household later.

## Not planned

- **Separate Kanban boards (like Nextcloud Deck)**: cards would duplicate
  tasks (due dates, tags, descriptions) without showing up in the dashboard.
  The Tasks board view covers this instead.
- **Password manager**: too much security risk to build ourselves.
- **Chat and mail (Talk, Mail)**: far larger than the rest of the app.
- **Files and Photos**: revisit once note attachments are running on Neon
  Object Storage.
- **Forms and Polls**: built for groups, while Nestery is personal.
