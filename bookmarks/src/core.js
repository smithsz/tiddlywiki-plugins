/*\
title: $:/plugins/claude/bookmarks/core.js
type: application/javascript
module-type: library

Shared model for the bookmark bar: ordered entries, labels, icons and the
order bookkeeping that keeps the bar and its folders in a stable sequence.

\*/
(function(){
"use strict";

var ITEM_TAG = "$:/bookmarks/item";
var ITEM_PREFIX = "$:/bookmarks/item/";
var STEP = 10;
var MAX_DEPTH = 12;
var SCHEMES = /^(?:https?|ftp|ftps|file|mailto|tel|sms|irc|ircs|news|nntp|gopher|gemini|ipfs|ipns|magnet):/i;
var UNSAFE = /^(?:javascript|data|vbscript|blob):/i;

/* "/Dev//Tools/ " -> "Dev/Tools" so a path has exactly one spelling */
function normFolder(value){
	var parts = String(value || "").split("/"), out = [];
	for(var i = 0; i < parts.length; i++){
		var seg = parts[i].trim();
		if(seg){ out.push(seg); }
	}
	return out.join("/");
}

function itemOrder(tiddler){
	var n = parseFloat(tiddler.fields.order);
	return isFinite(n) ? n : Infinity;
}

function host(url){
	var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#]+)/i.exec(String(url || "").trim());
	if(!m){ return ""; }
	var h = m[1].replace(/^[^@]*@/,"").replace(/:\d+$/,"").toLowerCase();
	return /^[a-z0-9.\-¡-￿]+$/.test(h) ? h : "";
}

function bareHost(url){
	return host(url).replace(/^www\./,"");
}

/*
A URL that is safe to put in an href, or "" for one that is not. Browsers
ignore control characters inside a scheme, so "java\nscript:" runs as
"javascript:" — strip them before deciding.
*/
function safeUrl(value){
	var s = String(value || "").replace(/[\u0000-\u001f\u007f]/g,"").trim();
	return UNSAFE.test(s) ? "" : s;
}

/* Returns a usable URL, or "" when the input looks like a tiddler title */
function normaliseUrl(value){
	var s = safeUrl(value);
	if(!s){ return ""; }
	if(SCHEMES.test(s) || /^[a-z][a-z0-9+.-]*:\/\//i.test(s)){ return s; }
	if(s.indexOf("//") === 0){ return "https:" + s; }
	if(/^[^\s\/?#:]+\.[a-z]{2,}(?::\d+)?(?:[\/?#].*)?$/i.test(s)){ return "https://" + s; }
	return "";
}

function label(wiki,title){
	var tiddler = wiki.getTiddler(title);
	if(!tiddler){ return title; }
	var caption = String(tiddler.fields.caption || "").trim();
	if(caption){ return caption; }
	var target = String(tiddler.fields.target || "").trim();
	if(target){ return target; }
	return bareHost(tiddler.fields.url) || String(tiddler.fields.url || "").trim() || title;
}

/*
Entries shown inside `folder`: its own bookmarks plus one entry per
immediate subfolder. A folder sits wherever its earliest bookmark sits, so
moving bookmarks moves the folder with them.
*/
function entries(wiki,folder){
	folder = normFolder(folder);
	var prefix = folder ? folder + "/" : "";
	var items = [], seen = Object.create(null), subfolders = [];
	wiki.getTiddlersWithTag(ITEM_TAG).forEach(function(title){
		var tiddler = wiki.getTiddler(title);
		if(!tiddler){ return; }
		var own = normFolder(tiddler.fields.folder), order = itemOrder(tiddler);
		if(own === folder){
			items.push({kind:"i",key:title,order:order,label:label(wiki,title)});
			return;
		}
		if(own.substr(0,prefix.length) !== prefix){ return; }
		var seg = own.substr(prefix.length).split("/")[0];
		if(!seg){ return; }
		var path = prefix + seg;
		if(!seen[path]){
			seen[path] = {kind:"f",key:path,order:order,label:seg};
			subfolders.push(seen[path]);
		} else if(order < seen[path].order){
			seen[path].order = order;
		}
	});
	return items.concat(subfolders).sort(function(a,b){
		if(a.order !== b.order){ return a.order < b.order ? -1 : 1; }
		var x = a.label.toLowerCase(), y = b.label.toLowerCase();
		return x < y ? -1 : (x > y ? 1 : 0);
	});
}

function encode(entry){ return entry.kind + ":" + entry.key; }

/* Every bookmark title in display order, depth first */
function flatten(wiki,folder,override,acc,depth){
	if(depth > MAX_DEPTH){ return acc; }
	var list = (override && override.folder === normFolder(folder)) ? override.entries : entries(wiki,folder);
	list.forEach(function(entry){
		if(entry.kind === "i"){ acc.push(entry.key); }
		else { flatten(wiki,entry.key,override,acc,depth + 1); }
	});
	return acc;
}

function renumber(wiki,titles){
	titles.forEach(function(title,index){
		var tiddler = wiki.getTiddler(title);
		if(!tiddler){ return; }
		var order = String((index + 1) * STEP);
		if(tiddler.fields.order === order){ return; }
		wiki.addTiddler(new $tw.Tiddler(tiddler,{order:order},wiki.getModificationFields()));
	});
}

/*
Swap an entry with its neighbour inside `folder`, then renumber the whole
bar from the new arrangement. Moving a folder moves all of its bookmarks.
*/
function move(wiki,entry,folder,direction){
	folder = normFolder(folder);
	var list = entries(wiki,folder), from = -1;
	for(var i = 0; i < list.length; i++){
		if(encode(list[i]) === entry){ from = i; break; }
	}
	if(from === -1){ return false; }
	var back = (direction === "up" || direction === "left" || direction === "previous");
	var to = back ? from - 1 : from + 1;
	if(to < 0 || to >= list.length){ return false; }
	var swap = list[from];
	list[from] = list[to];
	list[to] = swap;
	renumber(wiki,flatten(wiki,"",{folder:folder,entries:list},[],0));
	return true;
}

/*
Move one entry of `folder` so that it sits immediately before the entry
`before` ("" = at the end), then renumber the bar from the new arrangement.
*/
function arrange(wiki,entry,folder,before){
	var list = entries(wiki,folder), from = -1;
	for(var i = 0; i < list.length; i++){
		if(encode(list[i]) === entry){ from = i; break; }
	}
	if(from === -1){ return false; }
	var moved = list.splice(from,1)[0], to = -1;
	if(before){
		for(var j = 0; j < list.length; j++){
			if(encode(list[j]) === before){ to = j; break; }
		}
	}
	list.splice(to === -1 ? list.length : to,0,moved);
	renumber(wiki,flatten(wiki,"",{folder:folder,entries:list},[],0));
	return true;
}

/* Re-parent a folder, then order it among its new siblings */
function placeFolder(wiki,path,folder,before){
	path = normFolder(path);
	if(!path){ return false; }
	/* A folder cannot be dropped inside itself */
	if(folder === path || folder.substr(0,path.length + 1) === path + "/"){ return false; }
	var entry = "f:" + path;
	if(folder !== parent(path)){
		var to = folder ? folder + "/" + name(path) : name(path);
		if(!rename(wiki,path,to)){ return false; }
		entry = "f:" + normFolder(to);
	}
	return arrange(wiki,entry,folder,before);
}

/*
Drop `entry` ("i:<title>" or "f:<path>") into `folder`, landing immediately
before the entry `before` ("" = at the end). Bookmarks change folder, and a
folder carries everything below it along.
*/
function place(wiki,entry,folder,before){
	folder = normFolder(folder);
	if(!entry || entry === before){ return false; }
	var key = entry.substr(2);
	if(entry.substr(0,2) === "f:"){ return placeFolder(wiki,key,folder,before); }
	if(entry.substr(0,2) !== "i:"){ return false; }
	var tiddler = wiki.getTiddler(key);
	if(!tiddler){ return false; }
	if(normFolder(tiddler.fields.folder) !== folder){
		wiki.addTiddler(new $tw.Tiddler(tiddler,{folder:folder},wiki.getModificationFields()));
	}
	return arrange(wiki,entry,folder,before);
}

function folders(wiki,folder,acc,depth){
	if(depth > MAX_DEPTH){ return acc; }
	entries(wiki,folder).forEach(function(entry){
		if(entry.kind !== "f"){ return; }
		acc.push(entry.key);
		folders(wiki,entry.key,acc,depth + 1);
	});
	return acc;
}

function nextOrder(wiki){
	var max = 0;
	wiki.getTiddlersWithTag(ITEM_TAG).forEach(function(title){
		var tiddler = wiki.getTiddler(title);
		if(!tiddler){ return; }
		var n = parseFloat(tiddler.fields.order);
		if(isFinite(n) && n > max){ max = n; }
	});
	return max + STEP;
}

function freeTitle(wiki){
	var n = 1;
	while(wiki.tiddlerExists(ITEM_PREFIX + n) || wiki.isShadowTiddler(ITEM_PREFIX + n)){ n++; }
	return ITEM_PREFIX + n;
}

function add(wiki,options){
	options = options || {};
	var target = String(options.target || "").trim();
	var input = String(options.url || "").trim();
	var url = "";
	if(!target && input){
		url = normaliseUrl(input);
		if(!url){ target = input; }
	}
	if(!url && !target){ return ""; }
	var caption = String(options.label || "").trim();
	if(!caption){
		if(target){
			var tiddler = wiki.getTiddler(target);
			caption = (tiddler && String(tiddler.fields.caption || "").trim()) || target;
		} else {
			caption = bareHost(url) || url;
		}
	}
	var title = freeTitle(wiki);
	wiki.addTiddler(new $tw.Tiddler(wiki.getCreationFields(),{
		title: title,
		tags: [ITEM_TAG],
		caption: caption,
		url: url,
		target: target,
		folder: normFolder(options.folder),
		order: String(nextOrder(wiki)),
		text: ""
	},wiki.getModificationFields()));
	return title;
}

/* Add a bookmark at a given spot on the bar, rather than at the end */
function insert(wiki,options,folder,before){
	var fields = {}, field;
	for(field in options){ fields[field] = options[field]; }
	fields.folder = folder;
	var title = add(wiki,fields);
	if(title){ arrange(wiki,"i:" + title,normFolder(folder),before); }
	return title;
}

/* Rename or re-parent a folder, carrying everything below it along */
function rename(wiki,from,to){
	from = normFolder(from);
	to = normFolder(to);
	if(!from || from === to){ return false; }
	var prefix = from + "/";
	wiki.getTiddlersWithTag(ITEM_TAG).forEach(function(title){
		var tiddler = wiki.getTiddler(title);
		if(!tiddler){ return; }
		var own = normFolder(tiddler.fields.folder), next = null;
		if(own === from){
			next = to;
		} else if(own.substr(0,prefix.length) === prefix){
			var rest = own.substr(prefix.length);
			next = to ? to + "/" + rest : rest;
		}
		if(next === null){ return; }
		wiki.addTiddler(new $tw.Tiddler(tiddler,{folder:next},wiki.getModificationFields()));
	});
	return true;
}

/* Move one bookmark into a folder, landing at the end of it */
function setFolder(wiki,title,folder){
	var tiddler = wiki.getTiddler(title);
	if(!tiddler){ return false; }
	wiki.addTiddler(new $tw.Tiddler(tiddler,{
		folder: normFolder(folder),
		order: String(nextOrder(wiki))
	},wiki.getModificationFields()));
	return true;
}

function favicon(wiki,url){
	var mode = String(wiki.getTiddlerText("$:/config/bookmarks/favicons","duckduckgo") || "").trim();
	var h = host(url);
	if(!h || mode === "off"){ return ""; }
	if(mode === "google"){ return "https://www.google.com/s2/favicons?sz=32&domain=" + encodeURIComponent(h); }
	if(mode === "direct"){ return "https://" + h + "/favicon.ico"; }
	return "https://icons.duckduckgo.com/ip3/" + encodeURIComponent(h) + ".ico";
}

function hue(value){
	var s = String(value || ""), n = 0;
	for(var i = 0; i < s.length; i++){ n = (n * 31 + s.charCodeAt(i)) % 360; }
	return n;
}

/* The favicon for a bookmark, or "" when it has none to show */
function iconSrc(wiki,title){
	var tiddler = wiki.getTiddler(title);
	return tiddler ? favicon(wiki,tiddler.fields.url) : "";
}

/*
The hashed backdrop for the 16px square. It is drawn whether or not there is
a favicon, so a favicon that 404s leaves a coloured initial rather than a
hole; the icon widget clears it once the image has actually loaded.
*/
function chipStyle(wiki,title){
	var tiddler = wiki.getTiddler(title);
	var seed = tiddler ? (host(tiddler.fields.url) || String(tiddler.fields.target || "") || label(wiki,title)) : title;
	return "background:hsl(" + hue(seed) + ",46%,42%)";
}

function initial(wiki,title){
	var text = label(wiki,title).replace(/^[\s"'(\[{<‘“]+/,"");
	return (text.charAt(0) || "•").toUpperCase();
}

function name(path){
	var parts = normFolder(path).split("/");
	return parts[parts.length - 1] || "";
}

function parent(path){
	var parts = normFolder(path).split("/");
	parts.pop();
	return parts.join("/");
}

exports.ITEM_TAG = ITEM_TAG;
exports.normFolder = normFolder;
exports.normaliseUrl = normaliseUrl;
exports.entries = entries;
exports.encode = encode;
exports.folders = folders;
exports.label = label;
exports.iconSrc = iconSrc;
exports.chipStyle = chipStyle;
exports.initial = initial;
exports.name = name;
exports.parent = parent;
exports.host = host;
exports.safeUrl = safeUrl;
exports.move = move;
exports.place = place;
exports.insert = insert;
exports.add = add;
exports.rename = rename;
exports.setFolder = setFolder;

})();
