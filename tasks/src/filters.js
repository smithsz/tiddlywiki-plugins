/*\
title: $:/plugins/claude/tasks/filters.js
type: application/javascript
module-type: filteroperator

The filter operators the task views are built from.

Everything that depends on the time of day takes the current moment as an
operand rather than reading the clock itself. Views pass it the ticking
$:/temp/tasks/now, which is what makes a view notice that a task has gone
overdue while it is sitting open.

\*/
(function(){
"use strict";
var core = require("$:/plugins/claude/tasks/core.js");

function mapped(fn){
	return function(source,operator,options){
		var results = [];
		source(function(tiddler,title){ results.push(fn(options.wiki,title,operator.operand)); });
		return results;
	};
}

/* The tiddlers a view of <tag> draws from; no tag means every task */
exports.taskscope = function(source,operator,options){
	return core.scope(options.wiki,operator.operand || "");
};

/*
Narrow to one bucket and order it: taskselect<bucket>,<now>. As well as the
buckets a view shows, "open" takes everything unfinished, "scheduled" the
unfinished with a due date, and "all" the lot.
*/
exports.taskselect = function(source,operator,options){
	var titles = [];
	source(function(tiddler,title){ titles.push(title); });
	return core.select(options.wiki,titles,operator.operands[0],operator.operands[1]);
};

/* Which bucket each task is in: overdue, today, soon, someday, done... */
exports.taskbucket = mapped(core.bucket);

/* The heading a bucket is shown under */
exports.taskbucketcaption = function(source,operator,options){
	var results = [];
	source(function(tiddler,title){ results.push(core.CAPTIONS[title] || title); });
	return results;
};

exports.taskduetext = mapped(core.dueText);

/* "3 days overdue", "today", "in 2 weeks" */
exports.taskrelative = mapped(core.relative);

exports.taskcaption = mapped(core.caption);

/* How a task repeats, in words, or "" when it does not (or cannot be read) */
exports.taskrepeat = function(source,operator,options){
	var results = [];
	source(function(tiddler,title){
		results.push(core.repeatText(core.taskRepeat(options.wiki,title)));
	});
	return results;
};

/* "high", "medium", "low", or "" */
exports.taskpriority = mapped(core.priorityName);

/* The date a deferred task becomes live */
exports.taskstarttext = function(source,operator,options){
	var results = [];
	source(function(tiddler,title){
		var start = core.startDate(options.wiki,title);
		results.push(start ? $tw.utils.formatDateString(start,"ddd DD mmm") : "");
	});
	return results;
};

/* Every tag that has a task under it, the ones with most to do first */
exports.tasktags = function(source,operator,options){
	return core.tags(options.wiki);
};

})();
