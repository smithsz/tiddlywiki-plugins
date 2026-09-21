// A lightweight StreamLanguage-based highlighter for TiddlyWiki's wikitext.
// It is intentionally not a full grammar - it recognises the common inline
// and block constructs well enough to give useful syntax colouring inside
// the code-editor experience, without the cost of a real Lezer grammar.
import {StreamLanguage, LanguageSupport, indentUnit} from "@codemirror/language";
import {tags as t} from "@lezer/highlight";

const blockRules = [
	{regex: /^!{1,6}(?!!)/, token: "heading"},
	{regex: /^-{3,}\s*$/, token: "hr"},
	{regex: /^\|.*\|k?\s*$/, token: "table"},
	{regex: /^[*#>]+(?=[\s]|$)/, token: "listMark"},
	{regex: /^\\[\w.-]*/, token: "pragma"}
];

function wikitextTokenizer(stream, state) {
	// Block-level constructs only make sense at start of line
	if(stream.sol()) {
		for(const rule of blockRules) {
			const m = stream.match(rule.regex);
			if(m) {
				return rule.token;
			}
		}
	}
	// Code block fences ```
	if(stream.match(/^```/)) {
		state.inCodeBlock = !state.inCodeBlock;
		return "codeblockMark";
	}
	if(state.inCodeBlock) {
		stream.skipToEnd();
		return "codeblock";
	}
	// Comments <!--- ... --->
	if(stream.match(/^<!---/)) {
		state.inComment = true;
		return "comment";
	}
	if(state.inComment) {
		if(stream.match(/^[\s\S]*?--->/)) {
			state.inComment = false;
		} else {
			stream.skipToEnd();
		}
		return "comment";
	}
	// Inline code `...`
	if(stream.match(/^`[^`]*`?/)) {
		return "inlineCode";
	}
	// Triple-brace verbatim {{{...}}}
	if(stream.match(/^\{\{\{[\s\S]*?\}\}\}/)) {
		return "codeblock";
	}
	// Transclusion {{Title}} / {{Title||Template}} / {{{filter}}}
	if(stream.match(/^\{\{[^{}]*\}\}/)) {
		return "transclusion";
	}
	// Widgets / macro calls <<name ...>>
	if(stream.match(/^<<[^>]*>>/)) {
		return "macro";
	}
	// Wikilinks [[Title]] / [[Label|Title]]
	if(stream.match(/^\[\[[^\]]*\]\]/)) {
		return "link";
	}
	// External links [ext[Label|URL]] / [img[...]]
	if(stream.match(/^\[[a-zA-Z]*\[[^\]]*\]\]/)) {
		return "link";
	}
	// HTML-ish tags <tag ...>
	if(stream.match(/^<\/?[A-Za-z][\w-]*(\s[^<>]*)?\/?>/)) {
		return "htmlTag";
	}
	// Bold ''text''
	if(stream.match(/^''/)) {
		return "strong";
	}
	// Italic //text//
	if(stream.match(/^\/\//)) {
		return "emphasis";
	}
	// Underline __text__
	if(stream.match(/^__/)) {
		return "underline";
	}
	// Strikethrough ~~text~~
	if(stream.match(/^~~/)) {
		return "strikethrough";
	}
	// Superscript ^^text^^ / subscript ,,text,,
	if(stream.match(/^\^\^/) || stream.match(/^,,/)) {
		return "script";
	}
	// Style/class blocks @@...@@
	if(stream.match(/^@@/)) {
		return "styleMark";
	}
	stream.next();
	return null;
}

const tokenTable = {
	heading: t.heading,
	hr: t.contentSeparator,
	table: t.processingInstruction,
	listMark: t.list,
	pragma: t.meta,
	codeblockMark: t.meta,
	codeblock: t.monospace,
	comment: t.comment,
	inlineCode: t.monospace,
	transclusion: t.special(t.variableName),
	macro: t.macroName,
	link: t.link,
	htmlTag: t.tagName,
	strong: t.strong,
	emphasis: t.emphasis,
	underline: t.special(t.emphasis),
	strikethrough: t.strikethrough,
	script: t.special(t.string),
	styleMark: t.annotation
};

const wikitextStreamParser = {
	name: "tiddlywiki",
	startState() {
		return {inCodeBlock: false, inComment: false};
	},
	token: wikitextTokenizer,
	blankLine(state) {
		state.inCodeBlock = false;
	},
	tokenTable: tokenTable,
	languageData: {
		commentTokens: {block: {open: "<!---", close: "--->"}}
	}
};

export function wikitext() {
	const lang = StreamLanguage.define(wikitextStreamParser);
	return new LanguageSupport(lang, [indentUnit.of("  ")]);
}
