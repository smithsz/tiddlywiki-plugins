# tiddlywiki-plugins

A collection of [TiddlyWiki](https://tiddlywiki.com/) plugins.

## Plugins

### [bookmarks](bookmarks/bookmarks.json)

A browser-style bookmark bar: a narrow strip of favicon-and-name links with
folders that drop open underneath, a ☆ toolbar button for bookmarking the
tiddler you are reading, and a manager tiddler for reordering and renaming.
Bookmarks can point at a URL or at another tiddler. Drag bookmarks along the
bar or into folders to rearrange them, and drop a tiddler or a link onto the
bar to bookmark it.

Install by dragging `bookmarks.json` into a TiddlyWiki, or importing it. Then
open the *Bookmarks* tiddler, or add it to *$:/DefaultTiddlers*.

- `bookmarks/src/` — the plugin source, one file per tiddler
- `bookmarks/build.py` — assembles `src/` into `bookmarks.json`; run
  `python3 build.py` inside `bookmarks/` after editing a source file

### [momentum](momentum/momentum.json)

A Momentum-style start page: a full-bleed daily photo, live clock, greeting,
daily focus, quote and to-do list. Supports Unsplash/Pexels/Picsum photo
sources and an optional weather readout.

Install by dragging `momentum.json` into a TiddlyWiki, or importing it.

### [stylish](stylish/stylish.json)

A warm, Claude.ai-inspired theme with ivory surfaces and a clay accent,
shipping matching light and dark palettes.

Install by dragging `stylish.json` into a TiddlyWiki, or importing it. Then
select it under *Control Panel → Appearance → Theme*.

### [tasks](tasks/tasks.json)

Due dates on your tiddlers, and a date-ordered task list for any tag. A task
is an ordinary tiddler with a `due` field (`20261125235959999`, the same UTC
stamp TiddlyWiki writes to `created` and `modified`), so tasks are your own
tiddlers rather than entries in a hidden store. Tag them with whatever
groups them and each of those tags gets a list ordered by due date and
grouped under Overdue, Today, Tomorrow, This week, Later and No due date,
with anything overdue in red — the plugin defines no tags itself.

Dates can be typed in words (`fri`, `+3d`, `25 nov`, `tomorrow 9am`). Tasks
can repeat (`weekly`, `every 3 days`), carry a priority that breaks ties
within a day, and hold a `start` date that keeps them out of the way until
they are actionable. The sidebar shows a count of everything overdue, and
the Overdue heading can push the whole backlog to today. A tag's own tiddler
carries its list, `<<tasks YourTag>>` drops one into any tiddler, and a
toolbar button schedules whatever you are reading.

Install by dragging `tasks.json` into a TiddlyWiki, or importing it. Then
open the *Tasks* tiddler.

- `tasks/src/` — the plugin source, one file per tiddler
- `tasks/build.py` — assembles `src/` into `tasks.json`; run
  `python3 build.py` inside `tasks/` after editing a source file
- `tasks/test.js` — tests the packaged plugin: the date arithmetic, and the
  rendered views. Run `node test.js` inside `tasks/` (it finds TiddlyWiki in
  `node_modules`, in a global install, or wherever you point it:
  `node test.js /path/to/tiddlywiki`)

### [tw5-codemirror6](tw5-codemirror6/)

Replaces TiddlyWiki's plain textarea tiddler editor with a
[CodeMirror 6](https://codemirror.net/) editor: syntax highlighting
(including a purpose-built wikitext highlighter), line numbers, bracket
matching, autocomplete for links/macros/tiddler titles, find & replace, and
optional Vim/Emacs keybindings.

- `tw5-codemirror6/plugin/` — the plugin source (what actually ships)
- `tw5-codemirror6/build/` — the esbuild pipeline that bundles CodeMirror 6
  into `plugin/files/codemirror6-bundle.js`; run `npm install && npm run all`
  inside `build/` to rebuild and export a packaged `codemirror6-plugin.json`
- `tw5-codemirror6/test-wiki/` — a scratch wiki (symlinks the plugin source)
  for manual testing
- `tw5-codemirror6/codemirror6-plugin.json` — a packaged, single-file build
  of the plugin, ready to drag into a wiki

See [`plugin/readme.tid`](tw5-codemirror6/plugin/readme.tid) for full usage
and keyboard shortcuts.

## Installing a plugin

Each plugin's `.json` file is a self-contained TiddlyWiki plugin export.
Drag the file onto an open TiddlyWiki (or use *Control Panel → Plugins →
Get more plugins → Import*), then save and reload your wiki.
