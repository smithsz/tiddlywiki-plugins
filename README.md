# tiddlywiki-plugins

A collection of [TiddlyWiki](https://tiddlywiki.com/) plugins.

## Plugins

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
