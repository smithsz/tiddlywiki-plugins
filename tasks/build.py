# Assembles src/* into a single-file TiddlyWiki plugin JSON, the same shape
# as bookmarks/bookmarks.json and momentum/momentum.json.
import io, json, os, sys

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
P = "$:/plugins/claude/tasks"

def read(name):
    return io.open(os.path.join(SRC, name), encoding="utf-8").read()

def js(name, module_type):
    title = "%s/%s" % (P, name)
    return {"title": title, "type": "application/javascript",
            "module-type": module_type, "text": read(name)}

tiddlers = [
    js("core.js", "library"),
    js("filters.js", "filteroperator"),
    js("widgets.js", "widget"),
    js("picker.js", "widget"),
    js("startup.js", "startup"),

    {"title": "%s/board" % P, "text": read("board.tid")},
    {"title": "%s/templates/view" % P, "text": read("view.tid")},
    {"title": "%s/templates/group" % P, "text": read("group.tid")},
    {"title": "%s/templates/row" % P, "text": read("row.tid")},
    {"title": "%s/templates/due-popup" % P, "text": read("due-popup.tid")},
    {"title": "%s/templates/add-form" % P, "text": read("add-form.tid")},

    {"title": "%s/macros" % P, "tags": "$:/tags/Macro", "text": read("macros.tid")},
    {"title": "%s/styles" % P, "tags": "$:/tags/Stylesheet", "text": read("styles.tid")},
    {"title": "%s/viewtemplate" % P, "tags": "$:/tags/ViewTemplate",
     "list-after": "$:/core/ui/ViewTemplate/body", "text": read("viewtemplate.tid")},
    {"title": "%s/toolbar" % P, "tags": "$:/tags/ViewToolbar",
     "caption": "◴ Due date",
     "description": "Set a due date for this tiddler",
     "text": read("toolbar.tid")},
    {"title": "%s/pagecontrol" % P, "tags": "$:/tags/PageControls",
     "caption": "◴ Tasks",
     "description": "Opens the task list, with a count of anything overdue",
     "text": read("pagecontrol.tid")},
    {"title": "%s/readme" % P, "text": read("readme.tid")},

    {"title": "Tasks", "caption": "Tasks", "text": read("Tasks.tid")},

    {"title": "$:/config/tasks/tag", "text": ""},
    {"title": "$:/config/tasks/showdone", "text": "no"},
    {"title": "$:/config/tasks/inline", "text": "yes"},
    {"title": "$:/config/tasks/defaulttime", "text": "23:59"},
    {"title": "$:/config/tasks/overduecolour", "text": ""},
    {"title": "$:/config/tasks/showdeferred", "text": "no"},
    {"title": "$:/config/tasks/pagebadge", "text": "yes"},
    {"title": "$:/config/tasks/donetag", "text": "done"},
    {"title": "$:/config/tasks/todotag", "text": "todo"},
]

seen = set()
for t in tiddlers:
    if t["title"] in seen:
        sys.exit("duplicate tiddler: " + t["title"])
    seen.add(t["title"])

plugin = {
    "title": P,
    "name": "Tasks",
    "description": "Due dates, repeats and priorities on your tiddlers, with a date-ordered task list for any tag",
    "author": "Claude",
    "version": "1.6.2",
    "core-version": ">=5.2.0",
    "plugin-type": "plugin",
    "dependents": "",
    "type": "application/json",
    "list": "readme",
    "text": json.dumps({"tiddlers": dict((t["title"], t) for t in tiddlers)},
                       ensure_ascii=False, separators=(",", ":")),
}

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.json")
with io.open(out, "w", encoding="utf-8") as f:
    json.dump(plugin, f, ensure_ascii=False, indent=2)
    f.write(u"\n")
print("wrote %s (%d tiddlers, %d bytes)" % (out, len(tiddlers), os.path.getsize(out)))
