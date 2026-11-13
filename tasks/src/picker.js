/*\
title: $:/plugins/claude/tasks/picker.js
type: application/javascript
module-type: widget

<$task-due-picker task="..." field="due"/> sets one of a task's date
fields -- `due` unless told otherwise -- from a date and a time box.

The `due` field holds a UTC stamp while the boxes speak local dates, so
neither $edit-text nor a plain field binding can be pointed at it; this
widget does the conversion in both directions and writes on every change,
which saves the popup needing a Save button.

\*/
(function(){
"use strict";
var Widget = require("$:/core/modules/widgets/widget.js").widget;
var core = require("$:/plugins/claude/tasks/core.js");

var Picker = function(parseTreeNode,options){ this.initialise(parseTreeNode,options); };
Picker.prototype = new Widget();

Picker.prototype.render = function(parent,nextSibling){
	var self = this;
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	var wrapper = this.document.createElement("div");
	wrapper.className = "tk-picker";
	this.dateNode = this.document.createElement("input");
	this.dateNode.setAttribute("type","date");
	this.dateNode.className = "tk-input tk-input-date";
	this.dateNode.setAttribute("aria-label","Due date");
	this.timeNode = this.document.createElement("input");
	this.timeNode.setAttribute("type","time");
	this.timeNode.className = "tk-input tk-input-time";
	this.timeNode.setAttribute("aria-label","Due time");
	wrapper.appendChild(this.dateNode);
	wrapper.appendChild(this.timeNode);
	this.fill();
	this.dateNode.addEventListener("change",function(){ self.save(); },false);
	this.timeNode.addEventListener("change",function(){ self.save(); },false);
	parent.insertBefore(wrapper,nextSibling);
	this.domNodes.push(wrapper);
};

Picker.prototype.execute = function(){
	this.task = this.getAttribute("task",this.getVariable("currentTiddler",{defaultValue:""}));
	this.field = this.getAttribute("field",core.DUE_FIELD);
};

/* Show what the field currently says, remembering it so refresh can tell
   an outside edit from the write this widget has just made itself */
Picker.prototype.fill = function(){
	var values = core.pickerValues(this.wiki,this.task,this.field);
	this.dateNode.value = values.date;
	this.timeNode.value = values.time;
	this.timeNode.disabled = !values.date;
	this.written = this.stored();
};

Picker.prototype.stored = function(){
	var tiddler = this.wiki.getTiddler(this.task);
	return tiddler ? String(tiddler.fields[this.field] || "") : "";
};

Picker.prototype.save = function(){
	if(!this.task){ return; }
	var date = this.dateNode.value;
	if(!date){
		this.timeNode.value = "";
		this.timeNode.disabled = true;
		core.setField(this.wiki,this.task,this.field,"");
		this.written = this.stored();
		return;
	}
	this.timeNode.disabled = false;
	var stamp = core.stampFrom(this.wiki,date,this.timeNode.value);
	if(!stamp){ return; }
	core.setField(this.wiki,this.task,this.field,stamp);
	this.written = this.stored();
	/* A bare date is stored as the end of the day — show that back */
	if(!this.timeNode.value){ this.timeNode.value = core.pickerValues(this.wiki,this.task,this.field).time; }
};

Picker.prototype.refresh = function(changedTiddlers){
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.task || changedAttributes.field){
		this.refreshSelf();
		return true;
	}
	if(this.task && changedTiddlers[this.task] && this.stored() !== this.written){
		this.fill();
	}
	return false;
};

exports["task-due-picker"] = Picker;

})();
