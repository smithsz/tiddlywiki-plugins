/*\
title: $:/plugins/claude/bookmarks/drag.js
type: application/javascript
module-type: widget

Drag and drop for the bar: dragging bookmarks and folders into a new order,
dropping a tiddler or a link from anywhere else onto the bar to bookmark it,
and dragging a bookmark out to another window.

The widget renders no element of its own. It hangs its listeners on whatever
its children render — the link, or the folder's button — so the bar keeps
exactly the DOM it had before. That matters for more than tidiness:
TiddlyWiki positions a popup from its button's offset coordinates, so a
wrapper with position:relative here would displace every folder dropdown.

\*/
(function(){
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;
var core = require("$:/plugins/claude/bookmarks/core.js");

/* Our own transfer type, so a bar drag is told apart from any other drag */
var ENTRY_TYPE = "application/x-tiddlywiki-bookmarks-entry";
var ZONES = ["bm-drop-before","bm-drop-after","bm-drop-into"];

/* The bar drag in flight, if any: dataTransfer is unreadable until the drop */
var dragging = null;

function containsType(event,type){
	if($tw.utils.dragEventContainsType){ return $tw.utils.dragEventContainsType(event,type); }
	var types = event.dataTransfer && event.dataTransfer.types;
	return !!types && Array.prototype.indexOf.call(types,type) !== -1;
}

function containsFiles(event){
	return !!$tw.utils.dragEventContainsFiles && $tw.utils.dragEventContainsFiles(event);
}

var DragWidget = function(parseTreeNode,options){ this.initialise(parseTreeNode,options); };
DragWidget.prototype = new Widget();

DragWidget.prototype.render = function(parent,nextSibling){
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	if(this.zone === "end"){
		/* The run of empty bar past the last bookmark: a drop there appends */
		var node = this.document.createElement("span");
		node.className = "bm-drop-end";
		parent.insertBefore(node,nextSibling);
		this.domNodes.push(node);
		this.renderChildren(node,null);
		this.listen(node);
	} else {
		this.renderChildren(parent,nextSibling);
		this.listen(this.findFirstDomNode());
	}
};

DragWidget.prototype.execute = function(){
	this.entry = this.getAttribute("entry","");
	this.folder = this.getAttribute("folder","");
	this.axis = this.getAttribute("axis","x");
	this.zone = this.getAttribute("zone","item");
	this.isFolder = this.entry.substr(0,2) === "f:";
	this.makeChildWidgets();
};

DragWidget.prototype.listen = function(node){
	if(!node || !node.setAttribute){ return; }
	this.dropNode = node;
	/* A refresh can hand back the node we are already listening to */
	if(node.bmDragBound){ return; }
	node.bmDragBound = true;
	if(this.entry){ node.setAttribute("draggable","true"); }
	$tw.utils.addEventListeners(node,[
		{name: "dragstart", handlerObject: this, handlerMethod: "handleDragStartEvent"},
		{name: "dragend", handlerObject: this, handlerMethod: "handleDragEndEvent"},
		{name: "dragenter", handlerObject: this, handlerMethod: "handleDragOverEvent"},
		{name: "dragover", handlerObject: this, handlerMethod: "handleDragOverEvent"},
		{name: "dragleave", handlerObject: this, handlerMethod: "handleDragLeaveEvent"},
		{name: "drop", handlerObject: this, handlerMethod: "handleDropEvent"}
	]);
};

/* --- dragging one of our own ------------------------------------------- */

DragWidget.prototype.handleDragStartEvent = function(event){
	if(!this.entry || !event.dataTransfer){ return false; }
	dragging = {entry: this.entry, folder: this.folder};
	event.dataTransfer.effectAllowed = "all";
	event.dataTransfer.setData(ENTRY_TYPE,this.entry);
	/*
	Whatever the browser or the link widget already put on the drag is left
	alone, so a bookmark dragged into the wiki still imports its tiddler and
	one dragged to another window still carries its URL. A folder button has
	no payload of its own, so give it its name.
	*/
	if(this.isFolder){ event.dataTransfer.setData("text/plain",core.name(this.entry.substr(2))); }
	$tw.utils.addClass(this.dropNode,"bm-dragging");
	event.stopPropagation();
	return false;
};

DragWidget.prototype.handleDragEndEvent = function(event){
	dragging = null;
	if(this.dropNode){ $tw.utils.removeClass(this.dropNode,"bm-dragging"); }
	this.clearHighlight();
	return false;
};

/* --- working out where a drop lands ------------------------------------ */

/*
Which part of this entry the pointer is over: a bookmark splits in half, and
a folder keeps its middle for dropping things inside it, the way a browser's
bar does. The empty run at the end of the bar is only ever an append.
*/
DragWidget.prototype.dropZone = function(event){
	if(!this.entry){ return "before"; }
	var rect = this.dropNode.getBoundingClientRect();
	var along = this.axis === "y" ?
		(event.clientY - rect.top) / (rect.height || 1) :
		(event.clientX - rect.left) / (rect.width || 1);
	if(this.isFolder){
		if(along < 0.25){ return "before"; }
		return along > 0.75 ? "after" : "into";
	}
	return along < 0.5 ? "before" : "after";
};

/* The folder a drop puts things in, and the entry it should land in front of */
DragWidget.prototype.dropTarget = function(zone){
	if(!this.entry){ return {folder: this.folder, before: ""}; }
	if(zone === "into"){ return {folder: this.entry.substr(2), before: ""}; }
	if(zone === "before"){ return {folder: this.folder, before: this.entry}; }
	var list = core.entries(this.wiki,this.folder), next = "";
	for(var i = 0; i < list.length; i++){
		if(core.encode(list[i]) === this.entry){
			next = list[i + 1] ? core.encode(list[i + 1]) : "";
			break;
		}
	}
	return {folder: this.folder, before: next};
};

/* Spots core.place would refuse anyway, so the bar should not offer them */
DragWidget.prototype.refuses = function(zone){
	if(!dragging || !this.entry || zone !== "into"){ return false; }
	if(dragging.entry === this.entry){ return true; }
	if(dragging.entry.substr(0,2) !== "f:"){ return false; }
	var path = dragging.entry.substr(2), here = this.entry.substr(2);
	return here === path || here.substr(0,path.length + 1) === path + "/";
};

/* --- highlighting ------------------------------------------------------ */

DragWidget.prototype.highlight = function(zone){
	if(!this.dropNode){ return; }
	var wanted = "bm-drop-" + zone;
	for(var i = 0; i < ZONES.length; i++){
		if(ZONES[i] !== wanted){ $tw.utils.removeClass(this.dropNode,ZONES[i]); }
	}
	$tw.utils.addClass(this.dropNode,wanted);
};

DragWidget.prototype.clearHighlight = function(){
	if(!this.dropNode){ return; }
	for(var i = 0; i < ZONES.length; i++){ $tw.utils.removeClass(this.dropNode,ZONES[i]); }
};

/* --- taking a drop ----------------------------------------------------- */

DragWidget.prototype.handleDragOverEvent = function(event){
	if(["TEXTAREA","INPUT"].indexOf(event.target.tagName) !== -1){ return false; }
	if(containsFiles(event)){ return false; }
	var zone = this.dropZone(event);
	if(this.refuses(zone)){
		this.clearHighlight();
		event.dataTransfer.dropEffect = "none";
		return false;
	}
	/* Taking the default is how a drop target says it will accept the drop */
	event.preventDefault();
	event.stopPropagation();
	event.dataTransfer.dropEffect = dragging ? "move" : "copy";
	this.highlight(zone);
	return false;
};

DragWidget.prototype.handleDragLeaveEvent = function(event){
	var into = event.relatedTarget;
	if(into && this.dropNode && this.dropNode.contains(into)){ return false; }
	this.clearHighlight();
	return false;
};

DragWidget.prototype.handleDropEvent = function(event){
	var self = this;
	this.clearHighlight();
	if(containsFiles(event)){ return false; }
	var zone = this.dropZone(event);
	if(this.refuses(zone)){ return false; }
	var spot = this.dropTarget(zone);
	var entry = dragging ? dragging.entry :
		(containsType(event,ENTRY_TYPE) ? event.dataTransfer.getData(ENTRY_TYPE) : "");
	if(entry){
		core.place(this.wiki,entry,spot.folder,spot.before);
	} else {
		$tw.utils.importDataTransfer(event.dataTransfer,null,function(fieldsArray){
			fieldsArray.forEach(function(fields){ self.bookmarkDrop(fields,spot); });
		});
	}
	event.preventDefault();
	event.stopPropagation();
	return false;
};

/* Something from outside the bar: bookmark it where it was dropped */
DragWidget.prototype.bookmarkDrop = function(fields,spot){
	var title = String(fields.title || "").trim();
	var text = String(fields.text || "").trim();
	if(title){
		core.insert(this.wiki,{target: title},spot.folder,spot.before);
	} else if(core.normaliseUrl(text)){
		/* Only a real link is worth a bookmark; dropped prose is not */
		core.insert(this.wiki,{url: text},spot.folder,spot.before);
	}
};

DragWidget.prototype.refresh = function(changedTiddlers){
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.entry || changedAttributes.folder ||
		changedAttributes.axis || changedAttributes.zone){
		this.refreshSelf();
		return true;
	}
	var refreshed = this.refreshChildren(changedTiddlers);
	/* A child that re-rendered has handed us a new node to listen to */
	if(refreshed && this.zone !== "end"){ this.listen(this.findFirstDomNode()); }
	return refreshed;
};

exports["bookmark-drag"] = DragWidget;

})();
