/*\
title: $:/plugins/claude/tasks/startup.js
type: application/javascript
module-type: startup

Keeps $:/temp/tasks/now abreast of the clock.

Nothing else would tell an open task view that midnight has passed and that
today's deadline is now yesterday's. The views hand this tiddler to the task
filters, so rewriting it is what redraws them; it is truncated to the minute
and only written when that minute changes, which keeps the redraw down to
one a minute. Being under $:/temp/ it is neither saved nor counted as an
unsaved change.

\*/
(function(){
"use strict";
var core = require("$:/plugins/claude/tasks/core.js");

exports.name = "tasks-clock";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;

/* How often to look at the clock; the minute it reports changes less often */
var CHECK_INTERVAL = 15000;

function tick(){
	var now = new Date();
	now.setSeconds(0,0);
	var stamp = core.stringify(now);
	if($tw.wiki.getTiddlerText(core.NOW_TIDDLER,"") !== stamp){
		$tw.wiki.addTiddler(new $tw.Tiddler({title:core.NOW_TIDDLER,text:stamp}));
	}
}

exports.startup = function(){
	tick();
	if(typeof setInterval !== "undefined"){ setInterval(tick,CHECK_INTERVAL); }
};

})();
