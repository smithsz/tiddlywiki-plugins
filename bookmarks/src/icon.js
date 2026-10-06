/*\
title: $:/plugins/claude/bookmarks/icon.js
type: application/javascript
module-type: widget

The 16px icon chip. A favicon is drawn as a layer over a hashed colour and
the bookmark's initial, so a favicon that never arrives — a 404, a blocked
icon service, an offline wiki — leaves the initial behind instead of a hole,
and one that does arrive takes the square over.

\*/
(function(){
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;
var core = require("$:/plugins/claude/bookmarks/core.js");
var CONFIG = "$:/config/bookmarks/favicons";

var IconWidget = function(parseTreeNode,options){ this.initialise(parseTreeNode,options); };
IconWidget.prototype = new Widget();

IconWidget.prototype.render = function(parent,nextSibling){
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	var chip = this.document.createElement("span");
	chip.className = "bm-ico";
	chip.setAttribute("style",core.chipStyle(this.wiki,this.item));
	var text = this.document.createElement("span");
	text.className = "bm-ico-text";
	text.appendChild(this.document.createTextNode(core.initial(this.wiki,this.item)));
	chip.appendChild(text);
	var src = core.iconSrc(this.wiki,this.item);
	if(src){ this.addFavicon(chip,src); }
	parent.insertBefore(chip,nextSibling);
	this.domNodes.push(chip);
};

IconWidget.prototype.addFavicon = function(chip,src){
	var img = this.document.createElement("img");
	img.className = "bm-ico-img";
	img.setAttribute("alt","");
	$tw.utils.addEventListeners(img,[
		{name: "load", handlerFunction: function(){
			/* The icon is really there, so drop the colour it was standing in for */
			chip.removeAttribute("style");
			$tw.utils.addClass(chip,"bm-ico-loaded");
		}},
		{name: "error", handlerFunction: function(){
			if(img.parentNode){ img.parentNode.removeChild(img); }
		}}
	]);
	img.setAttribute("src",src);
	chip.appendChild(img);
};

IconWidget.prototype.execute = function(){
	this.item = this.getAttribute("item","");
};

IconWidget.prototype.refresh = function(changedTiddlers){
	var changedAttributes = this.computeAttributes();
	if(Object.keys(changedAttributes).length > 0 || changedTiddlers[this.item] || changedTiddlers[CONFIG]){
		this.refreshSelf();
		return true;
	}
	return false;
};

exports["bookmark-icon"] = IconWidget;

})();
