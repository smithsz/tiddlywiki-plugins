# wiki-tiddlers

Personal tiddlers for my own wiki — **not** distributable plugins.

Everything else in this repo (`stylish/`, `momentum/`, `tasks/`, `bookmarks/`,
`tw5-codemirror6/`) builds a plugin meant to be installed by anyone. This folder
is just loose `.tid` files I keep under version control so they survive a wiki
rebuild. There is no build step.

## Contents

| File | Tiddler | Role |
| --- | --- | --- |
| `my-fullscreen-editor-css.tid` | `$:/my/fullscreen-editor-css` | Stylesheet that makes one draft fill the window |
| `my-edit-toolbar-fullscreen.tid` | `$:/my/Buttons/fullscreen-editing` | Edit-mode toolbar button that toggles it |
| `fullscreen-editing-notes.tid` | `Fullscreen Editing` | How the above works, and the gotchas |

The two fullscreen tiddlers share the state tiddler `$:/state/my/fullscreen-editor`,
which holds the title of the draft currently fullscreened (or `none`). Read
`fullscreen-editing-notes.tid` first — it explains the scoping, the required
`\rules only` pragma, and why the selector is per-draft.

## Installing

Single-file wiki: drag the `.tid` files onto the wiki in the browser, import, save.

Node wiki: copy them into the wiki's `tiddlers/` directory and restart.
