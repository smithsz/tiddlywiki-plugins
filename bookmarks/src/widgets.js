/*\
title: $:/plugins/claude/bookmarks/widgets.js
type: application/javascript
module-type: widget

Action widgets for the jobs the filter language cannot do: adding a
bookmark, reordering one, and renaming a folder.

\*/
(function(){
"use strict";
var Widget = require("$:/core/modules/widgets/widget.js").widget;
var core = require("$:/plugins/claude/bookmarks/core.js");

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

exports["action-bookmarkadd"] = action(function(){
	core.add(this.wiki,{
		label: this.getAttribute("label",""),
		url: this.getAttribute("url",""),
		target: this.getAttribute("target",""),
		folder: this.getAttribute("folder","")
	});
});

exports["action-bookmarkmove"] = action(function(){
	core.move(this.wiki,this.getAttribute("entry",""),this.getAttribute("folder",""),this.getAttribute("direction","up"));
});

exports["action-bookmarkrename"] = action(function(){
	core.rename(this.wiki,this.getAttribute("folder",""),this.getAttribute("to",""));
});

exports["action-bookmarkfolder"] = action(function(){
	core.setFolder(this.wiki,this.getAttribute("item",""),this.getAttribute("folder",""));
});

})();
