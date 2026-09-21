import * as esbuild from "esbuild";
import {fileURLToPath} from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.resolve(__dirname, "../plugin/files/codemirror6-bundle.js");

const result = await esbuild.build({
	entryPoints: [path.resolve(__dirname, "src/bundle-entry.js")],
	bundle: true,
	format: "iife",
	target: ["es2019"],
	outfile: outfile,
	minify: true,
	sourcemap: false,
	logLevel: "info",
	metafile: true
});

const jsSize = (await import("node:fs")).statSync(outfile).size;
console.log(`Bundled CodeMirror 6 -> ${path.relative(process.cwd(), outfile)} (${(jsSize / 1024).toFixed(1)} KB)`);
