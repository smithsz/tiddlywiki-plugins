// Single-file bundle that assembles CodeMirror 6 into a TiddlyWiki-friendly
// `CM6` global. TiddlyWiki's module system is CommonJS-ish and doesn't do
// npm/ESM resolution at runtime, so this bundle is built once with esbuild
// and shipped as a plain library tiddler that the plugin's engine.js talks to.
import {EditorState, Compartment, EditorSelection} from "@codemirror/state";
import {
	EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
	drawSelection, dropCursor, rectangularSelection, crosshairCursor,
	highlightSpecialChars, placeholder as placeholderExt
} from "@codemirror/view";
import {
	defaultKeymap, history, historyKeymap, indentWithTab, emacsStyleKeymap,
	toggleComment
} from "@codemirror/commands";
import {
	syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput,
	indentUnit, foldGutter, foldKeymap, StreamLanguage, LanguageSupport
} from "@codemirror/language";
import {
	autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap
} from "@codemirror/autocomplete";
import {searchKeymap, highlightSelectionMatches, openSearchPanel} from "@codemirror/search";
import {tags as t} from "@lezer/highlight";
import {vim} from "@replit/codemirror-vim";

import {javascript, localCompletionSource} from "@codemirror/lang-javascript";
import {css, cssCompletionSource} from "@codemirror/lang-css";
import {html, htmlCompletionSource} from "@codemirror/lang-html";
import {json} from "@codemirror/lang-json";
import {markdown} from "@codemirror/lang-markdown";

import {wikitext} from "./wikitext-lang.js";
import {wikitextCompletionSource} from "./wikitext-completions.js";

// ---------------------------------------------------------------------------
// Syntax colouring: mapped to CSS classes so the plugin's stylesheet tiddler
// (which uses TiddlyWiki's <<colour>> macros) controls the actual colours.
// ---------------------------------------------------------------------------
const cm6HighlightStyle = HighlightStyle.define([
	{tag: t.keyword, class: "cm6tw-tok-keyword"},
	{tag: [t.name, t.deleted, t.character, t.macroName], class: "cm6tw-tok-name"},
	{tag: [t.propertyName], class: "cm6tw-tok-property"},
	{tag: [t.function(t.variableName), t.labelName], class: "cm6tw-tok-function"},
	{tag: [t.color, t.constant(t.name), t.standard(t.name)], class: "cm6tw-tok-constant"},
	{tag: [t.definition(t.name), t.separator], class: "cm6tw-tok-definition"},
	{tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], class: "cm6tw-tok-type"},
	{tag: [t.operator, t.operatorKeyword], class: "cm6tw-tok-operator"},
	{tag: [t.url, t.escape, t.regexp, t.link], class: "cm6tw-tok-link"},
	{tag: t.tagName, class: "cm6tw-tok-tag"},
	{tag: t.attributeName, class: "cm6tw-tok-attribute"},
	{tag: [t.string, t.inserted], class: "cm6tw-tok-string"},
	{tag: t.monospace, class: "cm6tw-tok-monospace"},
	{tag: [t.meta, t.comment], class: "cm6tw-tok-comment"},
	{tag: t.strong, class: "cm6tw-tok-strong"},
	{tag: t.emphasis, class: "cm6tw-tok-emphasis"},
	{tag: t.strikethrough, class: "cm6tw-tok-strikethrough"},
	{tag: t.heading, class: "cm6tw-tok-heading"},
	{tag: [t.special(t.variableName)], class: "cm6tw-tok-transclusion"},
	{tag: [t.processingInstruction, t.list, t.contentSeparator], class: "cm6tw-tok-structure"},
	{tag: t.invalid, class: "cm6tw-tok-invalid"}
]);

// ---------------------------------------------------------------------------
// Content type -> language + completion sources
// ---------------------------------------------------------------------------
function languageForType(type) {
	switch(type) {
		case "application/javascript":
		case "text/javascript":
			return {support: javascript(), extraCompletions: [localCompletionSource]};
		case "application/json":
			return {support: json(), extraCompletions: []};
		case "text/css":
			return {support: css(), extraCompletions: [cssCompletionSource]};
		case "text/html":
			return {support: html(), extraCompletions: [htmlCompletionSource]};
		case "text/markdown":
		case "text/x-markdown":
			return {support: markdown(), extraCompletions: []};
		case "text/vnd.tiddlywiki":
		case "text/x-tiddlywiki":
			return {support: wikitext(), extraCompletions: [wikitextCompletionSource]};
		default:
			return {support: null, extraCompletions: []};
	}
}

// ---------------------------------------------------------------------------
// Editor factory
// ---------------------------------------------------------------------------
function buildKeymapExtensions(keymapName) {
	if(keymapName === "vim") {
		return [vim()];
	}
	if(keymapName === "emacs") {
		return [keymap.of(emacsStyleKeymap)];
	}
	return [];
}

function buildFeatureExtensions(settings) {
	const exts = [];
	if(settings.lineNumbers) {
		exts.push(lineNumbers());
	}
	if(settings.activeLine) {
		exts.push(highlightActiveLine(), highlightActiveLineGutter());
	}
	if(settings.foldGutter) {
		exts.push(foldGutter());
	}
	if(settings.highlightSelectionMatches) {
		exts.push(highlightSelectionMatches());
	}
	if(settings.lineWrapping) {
		exts.push(EditorView.lineWrapping);
	}
	exts.push(drawSelection(), dropCursor(), rectangularSelection(), crosshairCursor(), highlightSpecialChars());
	return exts;
}

function buildAutocompleteExtensions(settings, twSources) {
	const exts = [];
	if(settings.closeBrackets !== false) {
		exts.push(closeBrackets());
	}
	if(settings.autocomplete !== false) {
		exts.push(autocompletion({
			override: twSources && twSources.length ? twSources : undefined,
			activateOnTyping: true
		}));
	}
	return exts;
}

function CM6Editor(options) {
	const self = this;
	this.callbacks = options.callbacks || {};
	this.languageCompartment = new Compartment();
	this.keymapCompartment = new Compartment();
	this.featuresCompartment = new Compartment();
	this.autocompleteCompartment = new Compartment();
	this.readOnlyCompartment = new Compartment();
	this.indentCompartment = new Compartment();
	this.placeholderCompartment = new Compartment();
	this.currentType = options.type;
	this.settings = Object.assign({
		lineNumbers: true,
		lineWrapping: false,
		activeLine: true,
		foldGutter: false,
		highlightSelectionMatches: true,
		closeBrackets: true,
		autocomplete: true,
		keymap: "default",
		tabSize: 4,
		indentWithTabs: false
	}, options.settings || {});

	const langInfo = languageForType(options.type);
	const baseSources = langInfo.extraCompletions || [];
	const twSourceFns = this.callbacks.completionSources ? this.callbacks.completionSources() : [];
	const combinedSources = twSourceFns.concat(baseSources);

	const domEventHandlers = {
		keydown(event) {
			if(self.callbacks.onKeydown && self.callbacks.onKeydown(event)) {
				return true;
			}
			return false;
		},
		focus() {
			if(self.callbacks.onFocus) {
				self.callbacks.onFocus();
			}
		},
		paste(event) {
			if(self.callbacks.onPaste) {
				self.callbacks.onPaste(event);
			}
		},
		drop(event) {
			if(self.callbacks.isFileDropEnabled && self.callbacks.isFileDropEnabled()) {
				if(self.callbacks.onDrop) {
					self.callbacks.onDrop(event);
				}
			}
		},
		dragenter(event) {
			if(self.callbacks.onDragenter) {
				self.callbacks.onDragenter(event);
			}
		},
		dragover(event) {
			if(self.callbacks.onDragover) {
				self.callbacks.onDragover(event);
			}
		},
		dragleave(event) {
			if(self.callbacks.onDragleave) {
				self.callbacks.onDragleave(event);
			}
		},
		dragend(event) {
			if(self.callbacks.onDragend) {
				self.callbacks.onDragend(event);
			}
		}
	};

	const updateListener = EditorView.updateListener.of(function(update) {
		if(update.docChanged) {
			const text = update.state.doc.toString();
			if(self.callbacks.onChange) {
				self.callbacks.onChange(text);
			}
		}
	});

	const state = EditorState.create({
		doc: options.doc || "",
		extensions: [
			history(),
			syntaxHighlighting(cm6HighlightStyle, {fallback: true}),
			bracketMatching(),
			indentOnInput(),
			this.indentCompartment.of([
				indentUnit.of(this.settings.indentWithTabs ? "\t" : " ".repeat(this.settings.tabSize)),
				EditorState.tabSize.of(this.settings.tabSize)
			]),
			this.languageCompartment.of(langInfo.support ? langInfo.support : []),
			this.featuresCompartment.of(buildFeatureExtensions(this.settings)),
			this.autocompleteCompartment.of(buildAutocompleteExtensions(this.settings, combinedSources)),
			this.readOnlyCompartment.of(EditorState.readOnly.of(!!options.readOnly)),
			this.placeholderCompartment.of(options.placeholder ? placeholderExt(options.placeholder) : []),
			this.keymapCompartment.of(buildKeymapExtensions(this.settings.keymap)),
			keymap.of([
				...closeBracketsKeymap,
				...defaultKeymap,
				...searchKeymap,
				...historyKeymap,
				...foldKeymap,
				...completionKeymap,
				{key: "Mod-/", run: toggleComment},
				indentWithTab
			]),
			EditorView.domEventHandlers(domEventHandlers),
			updateListener
		]
	});

	this.domNode = document.createElement("div");
	this.domNode.className = "cm6tw-wrapper";

	this.view = new EditorView({
		state: state,
		parent: this.domNode
	});

	options.parentNode.insertBefore(this.domNode, options.nextSibling || null);
}

CM6Editor.prototype.getText = function() {
	return this.view.state.doc.toString();
};

CM6Editor.prototype.hasFocus = function() {
	return this.view.hasFocus;
};

CM6Editor.prototype.focus = function() {
	this.view.focus();
};

CM6Editor.prototype.updateDomNodeText = function(text) {
	this.view.dispatch({
		changes: {from: 0, to: this.view.state.doc.length, insert: text}
	});
};

CM6Editor.prototype.setLanguageForType = function(type) {
	if(type === this.currentType) {
		return;
	}
	this.currentType = type;
	const langInfo = languageForType(type);
	const twSourceFns = this.callbacks.completionSources ? this.callbacks.completionSources() : [];
	const combinedSources = twSourceFns.concat(langInfo.extraCompletions || []);
	this.view.dispatch({
		effects: [
			this.languageCompartment.reconfigure(langInfo.support ? langInfo.support : []),
			this.autocompleteCompartment.reconfigure(buildAutocompleteExtensions(this.settings, combinedSources))
		]
	});
};

CM6Editor.prototype.setText = function(text, type) {
	this.setLanguageForType(type);
	if(!this.hasFocus()) {
		this.updateDomNodeText(text);
	}
};

CM6Editor.prototype.setReadOnly = function(readOnly) {
	this.view.dispatch({
		effects: this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(!!readOnly))
	});
};

CM6Editor.prototype.reconfigureSettings = function(newSettings) {
	this.settings = Object.assign(this.settings, newSettings);
	const twSourceFns = this.callbacks.completionSources ? this.callbacks.completionSources() : [];
	const langInfo = languageForType(this.currentType);
	const combinedSources = twSourceFns.concat(langInfo.extraCompletions || []);
	this.view.dispatch({
		effects: [
			this.featuresCompartment.reconfigure(buildFeatureExtensions(this.settings)),
			this.autocompleteCompartment.reconfigure(buildAutocompleteExtensions(this.settings, combinedSources)),
			this.keymapCompartment.reconfigure(buildKeymapExtensions(this.settings.keymap)),
			this.indentCompartment.reconfigure([
				indentUnit.of(this.settings.indentWithTabs ? "\t" : " ".repeat(this.settings.tabSize)),
				EditorState.tabSize.of(this.settings.tabSize)
			])
		]
	});
};

CM6Editor.prototype.setHeight = function(cssValue) {
	if(cssValue === null) {
		this.view.dom.style.height = "";
		this.view.dom.style.maxHeight = "";
		this.view.scrollDOM.style.overflow = "";
	} else {
		this.view.dom.style.height = cssValue;
		this.view.scrollDOM.style.overflow = "auto";
	}
};

CM6Editor.prototype.openSearchPanel = function() {
	openSearchPanel(this.view);
};

CM6Editor.prototype.createTextOperation = function() {
	const range = this.view.state.selection.main;
	const text = this.view.state.doc.toString();
	const selStart = Math.min(range.anchor, range.head);
	const selEnd = Math.max(range.anchor, range.head);
	return {
		text: text,
		selStart: selStart,
		selEnd: selEnd,
		selection: text.substring(selStart, selEnd),
		cutStart: null,
		cutEnd: null,
		replacement: null,
		newSelStart: null,
		newSelEnd: null
	};
};

CM6Editor.prototype.executeTextOperation = function(operation) {
	let newText = operation.text;
	if(operation.replacement !== null) {
		this.view.dispatch({
			changes: {from: operation.cutStart, to: operation.cutEnd, insert: operation.replacement},
			selection: EditorSelection.range(operation.newSelStart, operation.newSelEnd)
		});
		newText = operation.text.substring(0, operation.cutStart) + operation.replacement + operation.text.substring(operation.cutEnd);
	}
	this.view.focus();
	return newText;
};

CM6Editor.prototype.destroy = function() {
	this.view.destroy();
};

const CM6 = {
	EditorState, Compartment, EditorSelection, EditorView, keymap,
	createEditor(options) {
		return new CM6Editor(options);
	},
	languageForType: languageForType,
	wikitextCompletionSource: wikitextCompletionSource
};

if(typeof window !== "undefined") {
	window.CM6 = CM6;
}

export default CM6;
