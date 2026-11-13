/*\
title: $:/plugins/claude/tasks/widgets.js
type: application/javascript
module-type: widget

Action widgets for the things the filter language cannot do: writing a due
date, pushing one back, ticking a task off and creating one.

\*/
(function(){
"use strict";
var Widget = require("$:/core/modules/widgets/widget.js").widget;
var core = require("$:/plugins/claude/tasks/core.js");

function action(invoke){
	var ActionWidget = function(parseTreeNode,options){ this.initialise(parseTreeNode,options); };
	ActionWidget.prototype = new Widget();
	ActionWidget.prototype.render = function(parent,nextSibling){
		this.computeAttributes();
		this.execute();
	};
	ActionWidget.prototype.execute = function(){};
	ActionWidget.prototype.refresh = function(changedTiddlers){
		var changedAttributes = this.computeAttributes();
		if(Object.keys(changedAttributes).length > 0){
			this.refreshSelf();
			return true;
		}
		return this.refreshChildren(changedTiddlers);
	};
	ActionWidget.prototype.invokeAction = function(triggeringWidget,event){
		invoke.call(this);
		return true;
	};
	return ActionWidget;
}

/* The task being acted on, defaulting to the tiddler the widget sits in */
function subject(widget){
	return widget.getAttribute("task",widget.getVariable("currentTiddler",{defaultValue:""}));
}

/*
Set, move or clear a due date. Give it a `date` ("2026-11-25") with an
optional `time`, an `offset` in days from today, a `shift` in days from
where the task already sits, or `clear` to unschedule it.
*/
exports["action-taskdue"] = action(function(){
	var title = subject(this);
	if(!title){ return; }
	if(this.getAttribute("clear","") === "yes"){
		core.setDue(this.wiki,title,"");
		return;
	}
	var shift = this.getAttribute("shift","");
	if(shift !== ""){
		core.setDue(this.wiki,title,core.shiftDue(this.wiki,title,shift));
		return;
	}
	var offset = this.getAttribute("offset","");
	if(offset !== ""){
		core.setDue(this.wiki,title,core.dueInDays(this.wiki,title,offset));
		return;
	}
	/* a date typed in words: "fri", "+3d", "25 nov", "tomorrow 9am" */
	var text = this.getAttribute("text","");
	if(text !== ""){
		var spoken = core.parseNatural(text,"");
		if(spoken){ core.setDue(this.wiki,title,core.stringify(spoken)); }
		return;
	}
	var date = this.getAttribute("date","");
	if(date === ""){
		core.setDue(this.wiki,title,"");
		return;
	}
	var stamp = core.stampFrom(this.wiki,date,this.getAttribute("time",""));
	if(stamp){ core.setDue(this.wiki,title,stamp); }
});

/*
Set the date a task becomes live, after which it stops being hidden away
under "Not started yet". Takes a `date` or a date in words as `text`.
*/
exports["action-taskstart"] = action(function(){
	var title = subject(this);
	if(!title){ return; }
	if(this.getAttribute("clear","") === "yes"){
		core.setField(this.wiki,title,core.START_FIELD,"");
		return;
	}
	var text = this.getAttribute("text",""), stamp = "";
	if(text !== ""){
		var spoken = core.parseNatural(text,"");
		if(!spoken){ return; }
		stamp = core.stringify(spoken);
	} else {
		stamp = core.stampFrom(this.wiki,this.getAttribute("date",""),this.getAttribute("time",""));
		if(!stamp){ return; }
	}
	core.setField(this.wiki,title,core.START_FIELD,stamp);
});

/* How often a task comes round again: "weekly", "every 3 days", "" for never */
exports["action-taskrepeat"] = action(function(){
	var title = subject(this);
	if(!title){ return; }
	var rule = this.getAttribute("repeat","").trim();
	if(rule && !core.parseRepeat(rule)){ return; }
	core.setField(this.wiki,title,core.REPEAT_FIELD,rule ? core.repeatText(core.parseRepeat(rule)) : "");
});

/* "high", "medium", "low", or "" to drop it */
exports["action-taskpriority"] = action(function(){
	var title = subject(this);
	if(!title){ return; }
	var level = this.getAttribute("priority","").trim().toLowerCase();
	core.setField(this.wiki,title,core.PRIORITY_FIELD,
		(level === "high" || level === "medium" || level === "low") ? level : "");
});

/* Tick a task off, or put it back; `state` forces one way or the other */
exports["action-taskdone"] = action(function(){
	var title = subject(this);
	if(!title){ return; }
	var state = this.getAttribute("state","");
	if(state === "yes"){ core.setDone(this.wiki,title,true); }
	else if(state === "no"){ core.setDone(this.wiki,title,false); }
	else { core.toggleDone(this.wiki,title); }
});

/* Create a task, or schedule and tag one that already exists */
exports["action-taskadd"] = action(function(){
	core.add(this.wiki,{
		title: this.getAttribute("title",""),
		tag: this.getAttribute("tag",""),
		date: this.getAttribute("date",""),
		time: this.getAttribute("time","")
	});
});

})();
