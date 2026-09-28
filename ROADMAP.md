# Nestery roadmap

Nestery is a personal tools app. Each tool is built in small phases; this file
tracks what is done, what is planned next, and ideas that were considered.

## Tasks

**Done**
- Personal task list with due dates, reminders, priority and status
- Tags (replaced projects), tag and date filters, side panel for editing
- Dashboard cards: reminders, deadlines, this week, recent activity
- Board view: To do / In progress / Done columns, drag a card to change its status

## Notes

**Done**
- Phase 1: notes with a rich-text editor (Tiptap), autosave, pin, search,
  delete with undo; note activity and a New Note action on the dashboard
- Phase 2: checklists, tables, links, highlight, a bubble menu for selected
  text and a block type menu
- Phase 3: Markdown paste, per-note Markdown source view, `.md` import and export

**Planned**
- **Attachments**: file and image uploads, images shown inline, drag-and-drop
  and paste to upload. Needs a storage decision first (e.g. Vercel Blob), an
  attachments table, a size limit, and cleanup when a note is deleted.
- **Integration**: tags on notes, shared with tasks (and counted in the
  dashboard's Overview); a Recent notes dashboard card; server-side full-text
  search once there are enough notes to need it.
- **Slash menu**: type `/` on an empty line to insert headings, lists,
  checklists, tables and so on.

## Ideas

Tools worth borrowing from Nextcloud, in rough order of priority:

- **Calendar**: month and week views of task due dates, reminders and public
  holidays (all existing data), with your own events added later.
- **Bookmarks**: save links with the page title and icon fetched
  automatically, organized with the shared tags.
- **Cookbook**: recipes with ingredients, steps and serving scaling; import
  from recipe sites that publish structured recipe data.
- **Budget**: personal income and expense tracking by category; possibly
  splitting costs within a household later.

## Not planned

- **Separate Kanban boards (like Nextcloud Deck)**: cards would duplicate
  tasks (due dates, tags, descriptions) without showing up in the dashboard.
  The Tasks board view covers this instead.
- **Password manager**: too much security risk to build ourselves.
- **Chat and mail (Talk, Mail)**: far larger than the rest of the app.
- **Files and Photos**: waiting on the storage decision for note attachments.
- **Forms and Polls**: built for groups, while Nestery is personal.
