/*\
title: $:/plugins/claude/bookmarks/filters.js
type: application/javascript
module-type: filteroperator

Filter operators the bar templates are built from.

\*/
(function(){
"use strict";
var core = require("$:/plugins/claude/bookmarks/core.js");

function mapped(fn){
	return function(source,operator,options){
		var results = [];
		source(function(tiddler,title){ results.push(fn(options.wiki,title)); });
		return results;
	};
}

/* Entries of a folder ("" = the bar itself), as "i:<title>" / "f:<path>" */
exports.bookmarkentries = function(source,operator,options){
	return core.entries(options.wiki,operator.operand || "").map(core.encode);
};

/* Every folder path below the operand, in display order */
exports.bookmarkfolders = function(source,operator,options){
	return core.folders(options.wiki,operator.operand || "",[],0);
};

exports.bookmarklabel = mapped(core.label);

/* A bookmark's URL, emptied out when it is not safe to put in an href */
exports.bookmarkurl = mapped(function(wiki,title){
	var tiddler = wiki.getTiddler(title);
	return tiddler ? core.safeUrl(tiddler.fields.url) : "";
});

exports.bookmarkname = function(source,operator,options){
	var results = [];
	source(function(tiddler,title){ results.push(core.name(title)); });
	return results;
};

exports.bookmarkparent = function(source,operator,options){
	var results = [];
	source(function(tiddler,title){ results.push(core.parent(title)); });
	return results;
};

})();
