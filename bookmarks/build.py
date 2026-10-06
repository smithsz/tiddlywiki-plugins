# Assembles src/* into a single-file TiddlyWiki plugin JSON, the same shape
# as momentum/momentum.json and stylish/stylish.json.
import io, json, os, sys

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
P = "$:/plugins/claude/bookmarks"

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

    {"title": "%s/bar" % P, "text": read("bar.tid")},
    {"title": "%s/templates/entry" % P, "text": read("entry.tid")},
    {"title": "%s/templates/item" % P, "text": read("item.tid")},
    {"title": "%s/templates/folder" % P, "text": read("folder.tid")},
    {"title": "%s/templates/menu" % P, "text": read("menu.tid")},
    {"title": "%s/templates/icon" % P, "text": read("icon.tid")},
    {"title": "%s/templates/folder-icon" % P, "text": read("folder-icon.tid")},
    {"title": "%s/templates/add-form" % P, "text": read("add-form.tid")},
    {"title": "%s/templates/manage-row" % P, "text": read("manage-row.tid")},

    {"title": "%s/manager" % P, "caption": "Bookmark manager", "text": read("manager.tid")},
    {"title": "%s/styles" % P, "tags": "$:/tags/Stylesheet", "text": read("styles.tid")},
    {"title": "%s/toolbar" % P, "tags": "$:/tags/ViewToolbar",
     "caption": "☆ Bookmark",
     "description": "Add this tiddler to the bookmark bar",
     "text": read("toolbar.tid")},
    {"title": "%s/readme" % P, "text": read("readme.tid")},

    {"title": "Bookmarks", "caption": "Bookmarks", "text": read("Bookmarks.tid")},

    {"title": "$:/config/bookmarks/favicons", "text": "duckduckgo"},
    {"title": "$:/config/bookmarks/labels", "text": "yes"},
    {"title": "$:/config/bookmarks/newtab", "text": "yes"},
]

seen = set()
for t in tiddlers:
    if t["title"] in seen:
        sys.exit("duplicate tiddler: " + t["title"])
    seen.add(t["title"])

plugin = {
    "title": P,
    "name": "Bookmarks",
    "description": "A browser-style bookmark bar: a narrow strip of links with folders that expand",
    "author": "Claude",
    "version": "1.0.1",
    "core-version": ">=5.2.0",
    "plugin-type": "plugin",
    "dependents": "",
    "type": "application/json",
    "list": "readme",
    "text": json.dumps({"tiddlers": dict((t["title"], t) for t in tiddlers)},
                       ensure_ascii=False, separators=(",", ":")),
}

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "bookmarks.json")
with io.open(out, "w", encoding="utf-8") as f:
    json.dump(plugin, f, ensure_ascii=False, indent=2)
    f.write(u"\n")
print("wrote %s (%d tiddlers, %d bytes)" % (out, len(tiddlers), os.path.getsize(out)))
