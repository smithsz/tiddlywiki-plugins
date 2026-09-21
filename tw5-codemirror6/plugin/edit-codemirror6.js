/*\
title: $:/plugins/samsmith/codemirror6/edit-codemirror6.js
type: application/javascript
module-type: widget

Edit-codemirror6 widget: a text editor widget that uses the CodeMirror6Engine
for both the toolbar and non-toolbar cases.

\*/

"use strict";

var editTextWidgetFactory = require("$:/core/modules/editor/factory.js").editTextWidgetFactory,
	CodeMirror6Engine = require("$:/plugins/samsmith/codemirror6/engine.js").CodeMirror6Engine;

exports["edit-codemirror6"] = editTextWidgetFactory(CodeMirror6Engine,CodeMirror6Engine);
