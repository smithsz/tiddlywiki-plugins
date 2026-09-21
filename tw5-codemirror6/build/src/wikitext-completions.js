// TiddlyWiki-aware autocompletion: tiddler titles after [[ or {{, and macro/
// widget names after <<. Reads live wiki content via the global `$tw` that
// TiddlyWiki puts on `window`, so this stays in sync with the wiki being
// edited without any plumbing from the editor engine.
const CORE_MACROS = [
	"now", "version", "qualify", "currentTiddler", "csvtiddlers", "displayshortcuts",
	"list-links", "list-thumbnails", "makedatauri", "tabs", "toc", "toc-selective",
	"toolbar", "translink", "message", "keyboard-driven-input", "gradient"
];

function getWiki() {
	const tw = typeof window !== "undefined" ? window.$tw : undefined;
	return tw && tw.wiki ? tw.wiki : null;
}

function tiddlerTitleOptions(prefix) {
	const wiki = getWiki();
	if(!wiki) {
		return [];
	}
	let titles;
	try {
		titles = wiki.filterTiddlers("[!is[system]sort[title]]");
	} catch(e) {
		titles = [];
	}
	const lower = prefix.toLowerCase();
	return titles
		.filter(function(title) { return title.toLowerCase().indexOf(lower) !== -1; })
		.slice(0, 50)
		.map(function(title) {
			return {label: title, type: "text", boost: title.toLowerCase().indexOf(lower) === 0 ? 1 : 0};
		});
}

function macroNameOptions(prefix) {
	const wiki = getWiki();
	const names = new Set(CORE_MACROS);
	if(wiki) {
		try {
			wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/Macro]]").forEach(function(title) {
				const shortTitle = title.split("/").pop();
				names.add(shortTitle);
			});
		} catch(e) { /* ignore */ }
	}
	const lower = prefix.toLowerCase();
	return Array.from(names)
		.filter(function(name) { return name.toLowerCase().indexOf(lower) !== -1; })
		.map(function(name) {
			return {label: name, type: "function"};
		});
}

function matchBefore(context, regex) {
	const line = context.state.doc.lineAt(context.pos);
	const textBefore = line.text.slice(0, context.pos - line.from);
	const m = regex.exec(textBefore);
	if(!m) {
		return null;
	}
	return {partial: m[1], from: context.pos - m[1].length};
}

export function wikitextCompletionSource(context) {
	let match = matchBefore(context, /\[\[([^\]|]*)$/);
	if(match) {
		const options = tiddlerTitleOptions(match.partial);
		if(!options.length && !context.explicit) {
			return null;
		}
		return {from: match.from, options: options, validFor: /^[^\]|]*$/};
	}

	match = matchBefore(context, /\{\{([^{}|]*)$/);
	if(match) {
		const options = tiddlerTitleOptions(match.partial);
		if(!options.length && !context.explicit) {
			return null;
		}
		return {from: match.from, options: options, validFor: /^[^{}|]*$/};
	}

	match = matchBefore(context, /<<([A-Za-z0-9_.\-]*)$/);
	if(match) {
		const options = macroNameOptions(match.partial);
		if(!options.length && !context.explicit) {
			return null;
		}
		return {from: match.from, options: options, validFor: /^[A-Za-z0-9_.\-]*$/};
	}

	return null;
}
