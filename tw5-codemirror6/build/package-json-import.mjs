// Regenerates codemirror6-plugin.json - a standalone, drag-and-droppable
// TiddlyWiki import file containing just the built plugin - by booting the
// demo wiki (test-wiki/, whose plugins/codemirror6 is a symlink to ../plugin)
// and rendering the plugin tiddler through TiddlyWiki's own JSON exporter.
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const testWikiPath = path.resolve(projectRoot, "test-wiki");
const outputName = "codemirror6-plugin.json";
const tiddlywikiBin = path.resolve(__dirname, "node_modules/.bin/tiddlywiki");

if(!fs.existsSync(tiddlywikiBin)) {
	console.error("tiddlywiki CLI not found - run `npm install` in build/ first.");
	process.exit(1);
}

execFileSync(tiddlywikiBin, [
	testWikiPath,
	"--render",
	"$:/temp/export-codemirror6",
	outputName,
	"text/plain"
], {stdio: "inherit"});

const rendered = path.resolve(testWikiPath, "output", outputName);
const dest = path.resolve(projectRoot, outputName);
fs.copyFileSync(rendered, dest);

const check = JSON.parse(fs.readFileSync(dest, "utf8"));
console.log(`Packaged ${check.length} plugin tiddler -> ${path.relative(process.cwd(), dest)} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
