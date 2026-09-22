/*\
title: $:/plugins/samsmith/codemirror6/engine.js
type: application/javascript
module-type: library

Text editor engine that renders a CodeMirror 6 instance in place of the
default textarea, following the same engine contract as
$:/core/modules/editor/engines/framed.js and simple.js (setText,
updateDomNodeText, getText, fixHeight, focus, createTextOperation,
executeTextOperation). See $:/plugins/samsmith/codemirror6/readme for how
this fits together.

\*/

"use strict";

var HEIGHT_VALUE_TITLE = "$:/config/TextEditor/EditorHeight/Height";
var CONFIG_PREFIX = "$:/config/codemirror6/";

// Load the bundled CodeMirror 6 build the first time an editor is needed
if($tw.browser && !window.CM6) {
	require("$:/plugins/samsmith/codemirror6/lib/codemirror6-bundle.js");
}

function getBoolConfig(title,fallback) {
	var text = $tw.wiki.getTiddlerText(title);
	if(text === undefined || text === "") {
		return fallback;
	}
	var value = text.trim().toLowerCase();
	return value === "true" || value === "yes";
}

function getIntConfig(title,fallback) {
	var text = $tw.wiki.getTiddlerText(title);
	var value = parseInt(text,10);
	return isNaN(value) ? fallback : value;
}

function getConfig() {
	return {
		lineNumbers: getBoolConfig(CONFIG_PREFIX + "lineNumbers",true),
		lineWrapping: getBoolConfig(CONFIG_PREFIX + "lineWrapping",false),
		activeLine: getBoolConfig(CONFIG_PREFIX + "activeLine",true),
		foldGutter: getBoolConfig(CONFIG_PREFIX + "foldGutter",false),
		highlightSelectionMatches: getBoolConfig(CONFIG_PREFIX + "highlightSelectionMatches",true),
		closeBrackets: getBoolConfig(CONFIG_PREFIX + "closeBrackets",true),
		autocomplete: getBoolConfig(CONFIG_PREFIX + "autocomplete",true),
		indentWithTabs: getBoolConfig(CONFIG_PREFIX + "indentWithTabs",false),
		tabSize: getIntConfig(CONFIG_PREFIX + "tabSize",4),
		keymap: $tw.wiki.getTiddlerText(CONFIG_PREFIX + "keyMap","default"),
		spellcheck: getBoolConfig(CONFIG_PREFIX + "spellcheck",true)
	};
}

function CodeMirror6Engine(options) {
	var self = this;
	options = options || {};
	this.widget = options.widget;
	this.value = options.value;
	this.parentNode = options.parentNode;
	this.nextSibling = options.nextSibling;

	this.editor = window.CM6.createEditor({
		parentNode: this.parentNode,
		nextSibling: this.nextSibling,
		doc: options.value,
		type: options.type,
		readOnly: this.widget.isDisabled === "yes",
		placeholder: this.widget.editPlaceholder,
		settings: getConfig(),
		callbacks: {
			onChange: function(text) {
				self.widget.saveChanges(text);
				if(self.widget.editInputActions) {
					self.widget.invokeActionString(self.widget.editInputActions,self.widget,null,{actionValue: text});
				}
			},
			onKeydown: function(event) {
				return self.widget.handleKeydownEvent(event);
			},
			onFocus: function() {
				if(self.widget.editCancelPopups) {
					$tw.popup.cancel(0);
				}
			},
			isFileDropEnabled: function() {
				return self.widget.isFileDropEnabled;
			},
			onDrop: function(event) {
				self.widget.handleDropEvent(event);
			},
			onPaste: function(event) {
				self.widget.handlePasteEvent(event);
			},
			onDragenter: function(event) {
				self.widget.handleDragEnterEvent(event);
			},
			onDragover: function(event) {
				self.widget.handleDragOverEvent(event);
			},
			onDragleave: function(event) {
				self.widget.handleDragLeaveEvent(event);
			},
			onDragend: function(event) {
				self.widget.handleDragEndEvent(event);
			}
		}
	});

	this.domNode = this.editor.domNode;
	if(this.widget.editClass) {
		this.domNode.className += " " + this.widget.editClass;
	}
	this.widget.domNodes.push(this.domNode);
}

/*
Set the text of the engine if it doesn't currently have focus
*/
CodeMirror6Engine.prototype.setText = function(text,type) {
	this.editor.setText(text,type);
};

/*
Update the DomNode with the new text regardless of focus
*/
CodeMirror6Engine.prototype.updateDomNodeText = function(text) {
	this.editor.updateDomNodeText(text);
};

/*
Get the text of the engine
*/
CodeMirror6Engine.prototype.getText = function() {
	return this.editor.getText();
};

/*
Fix the height of the editor to fit content/config
*/
CodeMirror6Engine.prototype.fixHeight = function() {
	if(this.widget.editAutoHeight) {
		this.editor.setHeight(null);
	} else if(this.widget.editRows) {
		this.editor.setHeight(this.widget.editRows + "em");
	} else {
		var fixedHeight = parseInt(this.widget.wiki.getTiddlerText(HEIGHT_VALUE_TITLE,"400px"),10);
		fixedHeight = Math.max(fixedHeight,20);
		this.editor.setHeight(fixedHeight + "px");
	}
};

/*
Focus the engine node
*/
CodeMirror6Engine.prototype.focus = function() {
	this.editor.focus();
};

/*
Create a blank structure representing a text operation
*/
CodeMirror6Engine.prototype.createTextOperation = function() {
	return this.editor.createTextOperation();
};

/*
Execute a text operation
*/
CodeMirror6Engine.prototype.executeTextOperation = function(operation) {
	return this.editor.executeTextOperation(operation);
};

exports.CodeMirror6Engine = $tw.browser ? CodeMirror6Engine : require("$:/core/modules/editor/engines/simple.js").SimpleEngine;
