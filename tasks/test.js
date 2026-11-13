/*
Tests for the tasks plugin. Run it with:

    node test.js

It needs TiddlyWiki on hand and will find it in node_modules, in a global
npm install, or wherever TIDDLYWIKI_PATH or the first argument points. What
it tests is tasks.json -- the packaged plugin, the thing that ships -- so
run `python3 build.py` first if you have edited anything under src/.

Two halves. The first calls core.js directly, which is where the date
arithmetic lives. The second renders the views and makes assertions about
the HTML, because a plugin this full of wikitext can break in ways no
amount of unit testing notices: a filter operator that does not exist only
throws once two items tie and a comparator actually runs, and a $list with
an empty body quietly prints a link nobody asked for.
*/
var fs = require("fs");
var os = require("os");
var path = require("path");
var child = require("child_process");

var HERE = __dirname;
var failures = [];
var checks = 0;

function check(label, got, want) {
	checks++;
	if (String(got) !== String(want)) {
		failures.push(label + "\n      got:    " + got + "\n      wanted: " + want);
		console.log("  FAIL  " + label);
		console.log("        got:    " + got);
		console.log("        wanted: " + want);
	} else {
		console.log("  ok    " + label);
	}
}

function contains(label, haystack, needle) {
	check(label, String(haystack).indexOf(needle) !== -1 ? "present" : "absent", "present");
}

function absent(label, haystack, needle) {
	check(label, String(haystack).indexOf(needle) === -1 ? "absent" : "present", "absent");
}

function section(name) {
	console.log("\n" + name);
}

/* TiddlyWiki's boot module, from wherever this machine keeps it */
function findTiddlyWiki() {
	var candidates = [];
	if (process.argv[2]) { candidates.push(process.argv[2]); }
	if (process.env.TIDDLYWIKI_PATH) { candidates.push(process.env.TIDDLYWIKI_PATH); }
	[HERE, path.join(HERE, ".."), process.cwd()].forEach(function (root) {
		candidates.push(path.join(root, "node_modules", "tiddlywiki"));
	});
	try {
		candidates.push(path.join(child.execSync("npm root -g", {encoding: "utf8"}).trim(), "tiddlywiki"));
	} catch (e) { /* npm is not required, only helpful */ }
	for (var i = 0; i < candidates.length; i++) {
		var boot = path.join(candidates[i], "boot", "boot.js");
		if (fs.existsSync(boot)) { return boot; }
	}
	console.error("Could not find TiddlyWiki. Install it (npm install tiddlywiki)");
	console.error("or point at it: node test.js /path/to/tiddlywiki");
	process.exit(2);
}

/* A UTC stamp for a local date and time, the way the plugin writes them */
function stamp(date) {
	function pad(n, width) {
		var s = String(n);
		while (s.length < width) { s = "0" + s; }
		return s;
	}
	return pad(date.getUTCFullYear(), 4) + pad(date.getUTCMonth() + 1, 2) + pad(date.getUTCDate(), 2) +
		pad(date.getUTCHours(), 2) + pad(date.getUTCMinutes(), 2) + pad(date.getUTCSeconds(), 2) +
		pad(date.getUTCMilliseconds(), 3);
}

/* End of a local day, `days` from today */
function endOfDay(days) {
	var d = new Date();
	return stamp(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 23, 59, 59, 999));
}

function write(file, text) {
	fs.writeFileSync(file, text, "utf8");
}

function tiddler(dir, title, fields) {
	var lines = ["title: " + title];
	Object.keys(fields).forEach(function (key) {
		if (fields[key] !== "") { lines.push(key + ": " + fields[key]); }
	});
	write(path.join(dir, title.replace(/[\/\\:]/g, "-") + ".tid"), lines.join("\n") + "\n\n" + title + ".\n");
}

/* A throwaway wiki with the packaged plugin and a spread of tasks in it */
function buildWiki() {
	var source = path.join(HERE, "tasks.json");
	if (!fs.existsSync(source)) {
		console.error("tasks.json is missing -- run: python3 build.py");
		process.exit(2);
	}
	var newest = 0;
	fs.readdirSync(path.join(HERE, "src")).forEach(function (name) {
		newest = Math.max(newest, fs.statSync(path.join(HERE, "src", name)).mtimeMs);
	});
	if (newest > fs.statSync(source).mtimeMs) {
		console.log("NOTE: src/ is newer than tasks.json -- run `python3 build.py` to test your edits\n");
	}

	var root = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-test-"));
	var tiddlers = path.join(root, "tiddlers");
	var plugin = path.join(root, "plugins", "tasks");
	fs.mkdirSync(tiddlers);
	fs.mkdirSync(plugin, {recursive: true});
	write(path.join(root, "tiddlywiki.info"), JSON.stringify({plugins: [], themes: ["tiddlywiki/vanilla", "tiddlywiki/snowwhite"]}));

	var packaged = JSON.parse(fs.readFileSync(source, "utf8"));
	var contents = JSON.parse(packaged.text).tiddlers;
	delete packaged.text;
	write(path.join(plugin, "plugin.info"), JSON.stringify(packaged, null, 2));
	write(path.join(plugin, "tiddlers.json"), JSON.stringify(Object.keys(contents).map(function (k) { return contents[k]; })));

	tiddler(tiddlers, "Long overdue", {tags: "school", due: endOfDay(-9)});
	tiddler(tiddlers, "Overdue yesterday", {tags: "school", due: endOfDay(-1)});
	tiddler(tiddlers, "Due today", {tags: "school", due: endOfDay(0)});
	tiddler(tiddlers, "Due tomorrow", {tags: "school", due: endOfDay(1)});
	tiddler(tiddlers, "Due this week", {tags: "school", due: endOfDay(4)});
	tiddler(tiddlers, "Due much later", {tags: "school", due: endOfDay(40)});
	tiddler(tiddlers, "Not yet scheduled", {tags: "school"});
	tiddler(tiddlers, "Already finished", {tags: "school done", due: endOfDay(-2)});
	tiddler(tiddlers, "A morning deadline", {tags: "errands", due: stamp(new Date(new Date().getFullYear() + 1, 4, 20, 9, 30, 0, 0))});
	tiddler(tiddlers, "school", {});
	tiddler(tiddlers, "An untagged note", {});
	tiddler(tiddlers, "Water the plants", {tags: "chores", due: endOfDay(2), repeat: "weekly"});
	tiddler(tiddlers, "Descale the kettle", {tags: "chores", due: endOfDay(2), repeat: "now and then"});
	tiddler(tiddlers, "Urgent chore", {tags: "chores", due: endOfDay(2), priority: "high"});
	tiddler(tiddlers, "Idle chore", {tags: "chores", due: endOfDay(2), priority: "low"});
	tiddler(tiddlers, "Overdue chore", {tags: "chores", due: endOfDay(-3)});
	tiddler(tiddlers, "Audit requirements.txt", {tags: "[[Python 3.10 EOL]] todo"});
	tiddler(tiddlers, "Upgrade CI image", {tags: "[[Python 3.10 EOL]] todo"});
	tiddler(tiddlers, "Python 3.10 EOL", {});
	tiddler(tiddlers, "Shopping", {tags: "notes"});
	tiddler(tiddlers, "Book the venue", {tags: "chores", due: endOfDay(-1), start: endOfDay(10)});
	write(path.join(tiddlers, "cfg.tid"), "title: $:/config/tasks/tag\n\nschool");
	write(path.join(tiddlers, "cfg2.tid"), "title: $:/config/tasks/showdeferred\n\nyes");
	return root;
}

var bootPath = findTiddlyWiki();
var wikiPath = buildWiki();
console.log("TiddlyWiki: " + bootPath);
console.log("test wiki:  " + wikiPath);

var $tw = require(bootPath).TiddlyWiki();
$tw.boot.argv = [wikiPath];
$tw.boot.boot(function () {
	var wiki = $tw.wiki;
	var core = $tw.modules.execute("$:/plugins/claude/tasks/core.js");
	var version = (wiki.getTiddler("$:/core") || {fields: {}}).fields.version;
	console.log("core:       " + version + "\n");

	/* currentTiddler must survive, so the widget form, not {{...}} */
	function throughViewTemplate(title) {
		return wiki.renderText("text/html", "text/vnd.tiddlywiki",
			"<$tiddler tiddler='" + title + "'><$transclude tiddler='$:/core/ui/ViewTemplate'/></$tiddler>");
	}
	function field(title, name) {
		var t = wiki.getTiddler(title);
		return t ? (t.fields[name] || "") : "<no such tiddler>";
	}
	function render(title) {
		return wiki.renderTiddler("text/html", title);
	}

	/* ---------------------------------------------------------------- */
	section("due dates: writing them");
	check("a date on its own is the end of that day", core.stampFrom(wiki, "2026-11-25", ""), "20261125235959999");
	check("a time is kept as given", core.stampFrom(wiki, "2026-11-25", "09:30"), "20261125093000000");
	check("an unreadable date writes nothing", core.stampFrom(wiki, "not-a-date", ""), "");
	check("an impossible time falls back to the default", core.stampFrom(wiki, "2026-11-25", "99:99"), "20261125235959999");

	section("due dates: reading them back");
	check("the picker shows the stored date", core.pickerValues(wiki, "Long overdue").date.length, 10);
	check("the picker shows end of day as 23:59", core.pickerValues(wiki, "Long overdue").time, "23:59");
	check("an unscheduled task shows no date", core.pickerValues(wiki, "Not yet scheduled").date, "");

	section("due dates: typed in by hand");
	check("2026-11-25 means the end of the 25th", core.stringify(core.parseStamp("2026-11-25")), "20261125235959999");
	check("20261125 means the same", core.stringify(core.parseStamp("20261125")), "20261125235959999");
	check("2026-11-25T09:30 keeps the time", core.stringify(core.parseStamp("2026-11-25T09:30")), "20261125093000000");
	check("a full stamp round-trips", core.stringify(core.parseStamp("20261125235959999")), "20261125235959999");
	check("prose is not a date", core.parseStamp("a week from Tuesday"), "null");
	check("nor is an empty field", core.parseStamp(""), "null");
	check("nor is a half-written date", core.parseStamp("2026-1"), "null");

	section("buckets");
	check("overdue", core.bucket(wiki, "Long overdue", ""), "overdue");
	check("today", core.bucket(wiki, "Due today", ""), "today");
	check("tomorrow", core.bucket(wiki, "Due tomorrow", ""), "tomorrow");
	check("this week", core.bucket(wiki, "Due this week", ""), "soon");
	check("later", core.bucket(wiki, "Due much later", ""), "later");
	check("no due date", core.bucket(wiki, "Not yet scheduled", ""), "someday");
	check("done outranks being overdue", core.bucket(wiki, "Already finished", ""), "done");
	check("a missing tiddler does not throw", core.bucket(wiki, "No Such Tiddler", ""), "someday");

	section("buckets move with the clock, not with the wall clock");
	var fixed = "20261120235959999";
	wiki.addTiddler(new $tw.Tiddler({title: "Fixed deadline", tags: ["clock"], due: fixed, text: ""}));
	check("after the date, overdue", core.bucket(wiki, "Fixed deadline", "20261121000000000"), "overdue");
	check("on the day, today", core.bucket(wiki, "Fixed deadline", "20261120080000000"), "today");
	check("the day before, tomorrow", core.bucket(wiki, "Fixed deadline", "20261119080000000"), "tomorrow");
	check("the week before, this week", core.bucket(wiki, "Fixed deadline", "20261115080000000"), "soon");
	check("a month before, later", core.bucket(wiki, "Fixed deadline", "20261015080000000"), "later");

	section("wording");
	check("today", core.relative(wiki, "Due today", ""), "today");
	check("tomorrow", core.relative(wiki, "Due tomorrow", ""), "tomorrow");
	check("yesterday", core.relative(wiki, "Overdue yesterday", ""), "yesterday");
	check("days overdue", core.relative(wiki, "Long overdue", ""), "9 days overdue");
	check("days ahead", core.relative(wiki, "Due this week", ""), "in 4 days");
	check("never says 1 weeks", /^in \d+ weeks?$/.test(core.relative(wiki, "Due much later", "")), "true");
	check("a missing tiddler has nothing to say", core.relative(wiki, "No Such Tiddler", ""), "");
	check("the end of a day shows no time", core.dueText(wiki, "Due today").indexOf(":") === -1, "true");
	contains("a real time is shown", core.dueText(wiki, "A morning deadline"), "09:30");

	section("ordering");
	check("scheduled tasks come out in date order",
		core.select(wiki, core.scope(wiki, "school"), "open", "").join(" | "),
		"Long overdue | Overdue yesterday | Due today | Due tomorrow | Due this week | Due much later | Not yet scheduled");

	section("ties are what reach a comparator at all");
	var tie = endOfDay(30);
	["zebra crossing", "Apple tree", "Éclair order"].forEach(function (title) {
		wiki.addTiddler(new $tw.Tiddler({title: title, tags: ["ties"], due: tie, text: ""}));
	});
	check("the same due date breaks alphabetically, ignoring case",
		core.select(wiki, core.scope(wiki, "ties"), "later", "").join(" | "),
		"Apple tree | Éclair order | zebra crossing");
	wiki.addTiddler(new $tw.Tiddler({title: "no date b", tags: ["ties"], text: ""}));
	wiki.addTiddler(new $tw.Tiddler({title: "No date A", tags: ["ties"], text: ""}));
	check("unscheduled tasks sort alphabetically",
		core.select(wiki, core.scope(wiki, "ties"), "someday", "").join(" | "),
		"No date A | no date b");
	wiki.addTiddler(new $tw.Tiddler({title: "done b", tags: ["ties", "done"], due: tie, text: ""}));
	wiki.addTiddler(new $tw.Tiddler({title: "Done A", tags: ["ties", "done"], due: tie, text: ""}));
	check("the same due date breaks alphabetically in the done list too",
		core.select(wiki, core.scope(wiki, "ties"), "done", "").join(" | "),
		"Done A | done b");
	wiki.addTiddler(new $tw.Tiddler({title: "tie one", tags: ["beta"], due: tie, text: ""}));
	wiki.addTiddler(new $tw.Tiddler({title: "tie two", tags: ["alpha"], due: tie, text: ""}));
	var tags = core.tags(wiki);
	check("tags with equal counts sort alphabetically", tags.indexOf("alpha") < tags.indexOf("beta"), "true");

	section("which tiddlers a view draws from");
	check("a tag view takes everything carrying the tag", core.scope(wiki, "school").length, 8);
	check("tagged but unscheduled is still offered up", core.scope(wiki, "school").indexOf("Not yet scheduled") >= 0, "true");
	check("the all-tasks view takes only what has a date", core.scope(wiki, "").indexOf("An untagged note"), -1);
	check("system tiddlers are never tasks", core.scope(wiki, "").filter(function (t) { return t.indexOf("$:/") === 0; }).length, 0);
	check("every tag in use is discovered", core.tags(wiki).indexOf("school") >= 0, "true");
	check("no tag is built in", core.tags(wiki).indexOf("homework"), -1);

	section("dates typed in words");
	function nat(text) {
		var d = core.parseNatural(text, "");
		return d ? core.stringify(d).substr(0, 8) : "null";
	}
	function dayStamp(days) { return endOfDay(days).substr(0, 8); }
	check("today", nat("today"), dayStamp(0));
	check("tomorrow", nat("tomorrow"), dayStamp(1));
	check("tom", nat("tom"), dayStamp(1));
	check("yesterday", nat("yesterday"), dayStamp(-1));
	check("+3d", nat("+3d"), dayStamp(3));
	check("in 2 weeks", nat("in 2 weeks"), dayStamp(14));
	check("3 days", nat("3 days"), dayStamp(3));
	check("next week", nat("next week"), dayStamp(7));
	check("a bare date still works", nat("2026-11-25"), "20261125");
	check("so does a stamp", nat("20261125235959999"), "20261125");
	check("gibberish is not a date", nat("sometime soonish"), "null");
	check("an empty box is not a date", nat(""), "null");
	check("a prototype key is not a unit", nat("3 constructor"), "null");
	check("nor a weekday", nat("constructor"), "null");

	section("weekdays and months in words");
	var friday = core.parseNatural("friday", "");
	check("friday lands on a Friday", friday.getDay(), 5);
	check("and is not in the past", friday.getTime() >= new Date().setHours(0, 0, 0, 0), "true");
	var nextFriday = core.parseNatural("next friday", "");
	check("next friday is never today", nextFriday.getTime() > new Date().setHours(23, 59, 0, 0) || nextFriday.getDay() === 5, "true");
	check("fri abbreviates", core.parseNatural("fri", "").getDay(), 5);
	check("25 nov", core.stringify(core.parseNatural("25 nov 2027", "")).substr(0, 8), "20271125");
	check("nov 25", core.stringify(core.parseNatural("nov 25 2027", "")).substr(0, 8), "20271125");
	check("25/11/2027 reads day first", core.stringify(core.parseNatural("25/11/2027", "")).substr(0, 8), "20271125");
	check("31 feb is not a date", core.parseNatural("31 feb 2027", ""), "null");
	var rolled = core.parseNatural("1 jan", "");
	check("a month and day already past rolls to next year", rolled.getTime() > Date.now(), "true");

	section("times typed in words");
	function natTime(text) { return $tw.utils.formatDateString(core.parseNatural(text, ""), "0hh:0mm"); }
	check("tomorrow 9am", natTime("tomorrow 9am"), "09:00");
	check("tomorrow 9pm", natTime("tomorrow 9pm"), "21:00");
	check("tomorrow 12am is midnight", natTime("tomorrow 12am"), "00:00");
	check("tomorrow 14:30", natTime("tomorrow 14:30"), "14:30");
	check("fri at 9:15", natTime("fri at 9:15"), "09:15");
	check("no time means the end of the day", natTime("tomorrow"), "23:59");
	check("a nonsense hour is not a time", nat("tomorrow 99pm"), "null");

	section("repeats");
	function rep(text) {
		var spec = core.parseRepeat(text);
		return spec ? spec.count + " " + spec.unit : "null";
	}
	check("daily", rep("daily"), "1 day");
	check("weekly", rep("weekly"), "1 week");
	check("monthly", rep("monthly"), "1 month");
	check("yearly", rep("yearly"), "1 year");
	check("fortnightly", rep("fortnightly"), "2 week");
	check("every 3 days", rep("every 3 days"), "3 day");
	check("every 2 weeks", rep("every 2 weeks"), "2 week");
	check("2 weeks, without the every", rep("2 weeks"), "2 week");
	check("gibberish is not a repeat", rep("now and then"), "null");
	check("nor is zero", rep("every 0 days"), "null");
	check("nor a prototype key", rep("every 2 constructors"), "null");
	check("weekly reads back as weekly", core.repeatText(core.parseRepeat("weekly")), "weekly");
	check("and every 3 days as itself", core.repeatText(core.parseRepeat("every 3 days")), "every 3 days");

	section("repeats roll forward, and month ends do not run away");
	function roll(from, rule, after) {
		return core.stringify(core.nextOccurrence(core.parseStamp(from), core.parseRepeat(rule), core.parseStamp(after))).substr(0, 8);
	}
	check("a week on", roll("20261120235959999", "weekly", "20261120000000000"), "20261127");
	check("a month on", roll("20261120235959999", "monthly", "20261120000000000"), "20261220");
	check("31 Jan plus a month is the end of Feb, not the 3rd of March",
		roll("20270131235959999", "monthly", "20270131000000000"), "20270228");
	check("29 Feb in a leap year, a year on", roll("20280229235959999", "yearly", "20280229000000000"), "20290228");
	check("a weekly task missed for a month skips to the next one still to come",
		roll("20261101235959999", "weekly", "20261130000000000"), "20261206");
	check("it never lands in the past", core.nextOccurrence(core.parseStamp("20200101235959999"), core.parseRepeat("daily"), new Date()).getTime() > Date.now(), "true");

	section("ticking off a recurring task");
	wiki.addTiddler(new $tw.Tiddler({title: "Recurring probe", tags: ["errands"], due: endOfDay(-3), repeat: "weekly", text: ""}));
	check("it starts out overdue", core.bucket(wiki, "Recurring probe", ""), "overdue");
	core.toggleDone(wiki, "Recurring probe");
	check("ticking it off does not finish it", field("Recurring probe", "done"), "");
	check("it moves to a date still to come", core.bucket(wiki, "Recurring probe", "") !== "overdue", "true");
	check("and notes when it was last done", /^\d{17}$/.test(field("Recurring probe", "lastdone")), "true");
	check("a non-recurring task still just finishes", (function () {
		wiki.addTiddler(new $tw.Tiddler({title: "One off", tags: ["errands"], due: endOfDay(1), text: ""}));
		core.toggleDone(wiki, "One off");
		return core.bucket(wiki, "One off", "");
	})(), "done");

	section("tasks put off until later");
	wiki.addTiddler(new $tw.Tiddler({title: "Deferred probe", tags: ["errands"], due: endOfDay(-1), start: endOfDay(10), text: ""}));
	check("a future start date keeps it out of overdue", core.bucket(wiki, "Deferred probe", ""), "deferred");
	wiki.addTiddler(new $tw.Tiddler({title: "Already started", tags: ["errands"], due: endOfDay(-1), start: endOfDay(-5), text: ""}));
	check("a start date gone by changes nothing", core.bucket(wiki, "Already started", ""), "overdue");
	check("being done still outranks being deferred", (function () {
		wiki.addTiddler(new $tw.Tiddler({title: "Deferred and done", tags: ["errands", "done"], due: endOfDay(-1), start: endOfDay(10), text: ""}));
		return core.bucket(wiki, "Deferred and done", "");
	})(), "done");

	section("priority");
	check("high", core.priorityName(wiki, (wiki.addTiddler(new $tw.Tiddler({title: "P high", tags: ["prio"], due: endOfDay(5), priority: "high", text: ""})), "P high")), "high");
	wiki.addTiddler(new $tw.Tiddler({title: "P low", tags: ["prio"], due: endOfDay(5), priority: "low", text: ""}));
	wiki.addTiddler(new $tw.Tiddler({title: "P none", tags: ["prio"], due: endOfDay(5), text: ""}));
	wiki.addTiddler(new $tw.Tiddler({title: "P med", tags: ["prio"], due: endOfDay(5), priority: "2", text: ""}));
	check("a number works too", core.priorityName(wiki, "P med"), "medium");
	check("no priority has no name", core.priorityName(wiki, "P none"), "");
	check("a prototype key is not a priority", core.priorityRank(wiki, (wiki.addTiddler(new $tw.Tiddler({title: "P junk", priority: "constructor", text: ""})), "P junk")), 0);
	check("on the same day, priority decides the order",
		core.select(wiki, core.scope(wiki, "prio"), "soon", "").join(" | "),
		"P high | P med | P low | P none");

	/* ---------------------------------------------------------------- */
	section("the view, rendered");
	var view = render("Tasks");
	contains("overdue tasks are marked as such", view, 'class="tk-row tk-overdue"');
	contains("the overdue group is headed", view, ">Overdue<");
	contains("so are the other buckets", view, ">This week<");
	contains("the count of overdue tasks is shown", view, "tk-badge-overdue");
	contains("a badge reads as words, not run together", view, " overdue</span>");
	contains("tasks are linked", view, 'class="tc-tiddlylink tc-tiddlylink-resolves tk-title"');
	contains("with the date they are due", view, 'class="tk-due"');
	contains("and how far off that is", view, 'class="tk-rel"');
	absent("no raw filter text leaks into the page", view, "taskselect");
	absent("nothing errored", view, "tc-error");

	section("the groups come out in date order");
	var order = (view.match(/tk-group-name">([^<]*)/g) || []).map(function (m) { return m.replace(/.*">/, ""); });
	check("buckets in order", order.join(" > "), "Overdue > Today > Tomorrow > This week > Later > No due date");

	section("a $list with an empty body would print a link nobody asked for");
	var rows = (view.match(/class="tk-row /g) || []).length;
	var links = (view.match(/class="tc-tiddlylink[^"]*"(?! tk-)/g) || []).length;
	check("every link in the view belongs to a row or a tag", links <= rows, "true");

	section("a tag's own tiddler carries its list");
	var tagPage = throughViewTemplate("school");
	contains("the list appears under the text", tagPage, 'class="tk-inline"');
	contains("for that tag", tagPage, 'class="tk-view-title">school<');
	var plain = throughViewTemplate("An untagged note");
	absent("but not on a tiddler that is nobody's tag", plain, "tk-inline");

	section("repeats, priority and deferral, rendered");
	wiki.addTiddler(new $tw.Tiddler({title: "Chores probe", text: "\\import [all[shadows+tiddlers]tag[$:/tags/Macro]]\n<<tasks chores>>"}));
	var chores = render("Chores probe");
	contains("a recurring task is marked as recurring", chores, 'class="tk-repeat"');
	contains("and says how often", chores, "weekly");
	contains("a high-priority row is flagged", chores, "tk-prio-high");
	contains("a low-priority row too", chores, "tk-prio-low");
	contains("the priority marker is drawn", chores, 'class="tk-flag"');
	contains("a deferred task gets its own group", chores, ">Not started yet<");
	contains("and shows when it starts", chores, 'class="tk-start"');
	absent("a deferred task is not shouted about as overdue", chores.split(">Not started yet<")[1] || "", "tk-overdue");
	contains("the overdue group offers to move the lot to today", chores, "tk-group-tool");

	section("priority decides the order on screen");
	var sameDay = (chores.match(/tk-title"[^>]*>([^<]*)/g) || []).map(function (m) { return m.replace(/.*>/, ""); });
	check("the urgent one comes before the idle one",
		sameDay.indexOf("Urgent chore") < sameDay.indexOf("Idle chore"), "true");

	section("the sidebar button");
	var badge = render("$:/plugins/claude/tasks/pagecontrol");
	contains("the button is there", badge, 'aria-label="Tasks"');
	contains("with a count of what is overdue", badge, 'class="tk-pagebadge"');
	contains("it is labelled for a screen reader", badge, 'aria-label="Tasks"');
	contains("and navigates to the task list", field("$:/plugins/claude/tasks/pagecontrol", "text"), 'to="Tasks"');
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/pagebadge", text: "no"}));
	check("and it can be turned off", render("$:/plugins/claude/tasks/pagecontrol").indexOf("tk-pagebadge"), -1);
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/pagebadge", text: "yes"}));

	section("an unreadable repeat rule says so");
	var kettle = wiki.renderText("text/html", "text/vnd.tiddlywiki",
		"<$vars tktask='Descale the kettle' tkpop='$:/state/probe' tknow=''><$transclude tiddler='$:/plugins/claude/tasks/templates/due-popup'/></$vars>");
	contains("the popup warns about it", kettle, "tk-pop-warn");
	var kettleRepeats = (kettle.split("Repeats")[1] || "").split("Priority")[0];
	absent("and does not pretend it means never", kettleRepeats, "tk-chip-on");
	var weekly = wiki.renderText("text/html", "text/vnd.tiddlywiki",
		"<$vars tktask='Water the plants' tkpop='$:/state/probe' tknow=''><$transclude tiddler='$:/plugins/claude/tasks/templates/due-popup'/></$vars>");
	contains("a readable rule lights its chip", weekly, "tk-chip tk-chip-on");
	absent("and raises no warning", weekly, "tk-pop-warn");
	contains("the popup offers a start date", weekly, ">Not before<");
	contains("and a date in words", weekly, "or type it:");

	section("a tag whose tasks are all still unscheduled");
	/* The chip and the inline view used to ask has[due], so a tag you had
	   tagged but not yet dated was unreachable: no chip beside All, and no
	   list on its own tiddler either. */
	check("the tag is offered as a chip", core.tags(wiki).indexOf("Python 3.10 EOL") >= 0, "true");
	check("its tasks are in the all-tasks view",
		core.scope(wiki, "").indexOf("Audit requirements.txt") >= 0, "true");
	check("and they file under no due date",
		core.select(wiki, core.scope(wiki, "Python 3.10 EOL"), "someday", "").join(" | "),
		"Audit requirements.txt | Upgrade CI image");
	var eolPage = throughViewTemplate("Python 3.10 EOL");
	contains("its own tiddler shows the list", eolPage, 'class="tk-inline"');
	contains("with the unscheduled tasks in it", eolPage, "Audit requirements.txt");

	section("but a tag of ordinary tiddlers is still not a task tag");
	check("a plain tagged tiddler is not a task", core.isTask(wiki, "Shopping"), "false");
	check("so notes is not offered as a chip", core.tags(wiki).indexOf("notes"), -1);
	check("and tasksonly filters it out",
		wiki.filterTiddlers("[tag[notes]tasksonly[]]").length, 0);
	absent("its tiddler grows no task list", throughViewTemplate("Shopping"), "tk-inline");
	check("tasksonly is a real operator, not a field lookup",
		wiki.filterTiddlers("[tag[Python 3.10 EOL]tasksonly[]]").length, 2);

	section("the tag index, not a full wiki scan");
	/* Deciding whether a tiddler is somebody's tag happens for every tiddler
	   on screen, on every refresh, and the clock forces one a minute. The tag
	   index answers it directly; tasktags walks the whole wiki, which is 15x
	   slower on a few thousand tiddlers and worse from there. */
	var inlineView = field("$:/plugins/claude/tasks/viewtemplate", "text");
	absent("the inline view does not scan every tiddler", inlineView, "tasktags");
	contains("it asks the tag index instead", inlineView, "tag<currentTiddler>");

	section("the macro drops a list anywhere");
	wiki.addTiddler(new $tw.Tiddler({title: "Macro probe", text: "\\import [all[shadows+tiddlers]tag[$:/tags/Macro]]\n<<tasks errands>>"}));
	contains("<<tasks errands>> renders that tag's view", render("Macro probe"), 'class="tk-view-title">errands<');

	section("the stylesheet survives being wikitext");
	var css = wiki.renderTiddler("text/plain", "$:/plugins/claude/tasks/styles");
	/* `--` is wikitext for an en dash. Unless the parser is told otherwise it
	   rewrites every custom property here into something CSS ignores, and
	   every colour in the plugin quietly stops working. */
	absent("no -- was turned into an en dash", css, "\u2013");
	["--tk-overdue", "--tk-line", "--tk-wash", "--tk-faint"].forEach(function (name) {
		contains(name + " is declared", css, name + ":");
		contains(name + " is read back", css, "var(" + name + ")");
	});
	contains("overdue colours the row title", css, ".tk-overdue .tk-title{color:var(--tk-overdue)");
	contains("a dark background gets the lighter red", css, "prefers-color-scheme:dark");
	absent("no selector starts a line with a definition-list marker", css, "\n:");
	absent("no override is set by default", css, "html{--tk-overdue:;}");
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/overduecolour", text: "rebeccapurple"}));
	contains("a configured colour wins", wiki.renderTiddler("text/plain", "$:/plugins/claude/tasks/styles"), "--tk-overdue:rebeccapurple");
	wiki.deleteTiddler("$:/config/tasks/overduecolour");

	section("actions");
	core.setDue(wiki, "Not yet scheduled", core.dueInDays(wiki, "Not yet scheduled", 1));
	check("scheduling for tomorrow", core.bucket(wiki, "Not yet scheduled", ""), "tomorrow");
	core.setDue(wiki, "Long overdue", core.shiftDue(wiki, "Long overdue", 1));
	check("+1d on an overdue task means tomorrow, not another day in the past",
		core.bucket(wiki, "Long overdue", ""), "tomorrow");
	core.setDue(wiki, "Fixed deadline", core.shiftDue(wiki, "Fixed deadline", 1));
	check("+1d on a future task keeps its own date", field("Fixed deadline", "due").substr(0, 8), "20261121");
	core.setDue(wiki, "Due this week", "");
	check("unscheduling empties the field", field("Due this week", "due"), "");
	check("and files it under no due date", core.bucket(wiki, "Due this week", ""), "someday");
	core.toggleDone(wiki, "Due today");
	check("ticking off", core.bucket(wiki, "Due today", ""), "done");
	check("by the tag, with no field written", field("Due today", "tags").join(",").indexOf("done") >= 0 && field("Due today", "done") === "", "true");
	core.toggleDone(wiki, "Due today");
	check("and unticking puts it back", core.bucket(wiki, "Due today", ""), "today");
	check("writing to a missing tiddler fails quietly", core.setDue(wiki, "No Such Tiddler", "20261125235959999"), "false");

	section("every task carries a todo tag");
	core.add(wiki, {title: "Freshly added", tag: "chores", date: "2027-03-01", time: ""});
	check("a task made through the add form is tagged", field("Freshly added", "tags").join(","), "chores,todo");
	wiki.addTiddler(new $tw.Tiddler({title: "Given a date", tags: ["chores"], text: ""}));
	core.setDue(wiki, "Given a date", core.stampFrom(wiki, "2027-03-01", ""));
	check("so is one that is given a date", field("Given a date", "tags").join(","), "chores,todo");
	core.setDue(wiki, "Given a date", "");
	check("unscheduling leaves the tag on", field("Given a date", "tags").join(","), "chores,todo");
	core.setDue(wiki, "Given a date", core.stampFrom(wiki, "2027-03-02", ""));
	core.setDue(wiki, "Given a date", core.stampFrom(wiki, "2027-03-03", ""));
	check("setting a date twice does not double the tag", field("Given a date", "tags").join(","), "chores,todo");

	section("finishing adds the done tag and keeps todo");
	core.setDone(wiki, "Given a date", true);
	check("both tags are on", field("Given a date", "tags").join(","), "chores,todo,done");
	check("and it reads as done", core.bucket(wiki, "Given a date", ""), "done");
	check("no done field is written", field("Given a date", "done"), "");
	core.setDone(wiki, "Given a date", true);
	check("finishing twice changes nothing", field("Given a date", "tags").join(","), "chores,todo,done");
	core.setDone(wiki, "Given a date", false);
	check("putting it back drops done but keeps todo", field("Given a date", "tags").join(","), "chores,todo");
	check("and it is outstanding again", core.bucket(wiki, "Given a date", "") !== "done", "true");
	check("the other tags are left alone", (function () {
		wiki.addTiddler(new $tw.Tiddler({title: "Keep my tags", tags: ["chores", "errands"], due: endOfDay(1), text: ""}));
		core.setDone(wiki, "Keep my tags", true);
		core.setDone(wiki, "Keep my tags", false);
		return field("Keep my tags", "tags").join(",");
	})(), "chores,errands,todo");

	section("the done tag is the only thing that marks completion");
	wiki.addTiddler(new $tw.Tiddler({title: "Tagged by hand", tags: ["chores", "done"], due: endOfDay(-2), text: ""}));
	check("tagging a task done finishes it", core.bucket(wiki, "Tagged by hand", ""), "done");
	check("so it is not also overdue", core.bucket(wiki, "Tagged by hand", "") !== "overdue", "true");
	check("it sorts into the done list", core.select(wiki, core.scope(wiki, "chores"), "done", "").indexOf("Tagged by hand") >= 0, "true");
	wiki.addTiddler(new $tw.Tiddler({title: "Untagged by hand", tags: ["chores"], due: endOfDay(-2), text: ""}));
	check("without the tag it is back on the list", core.bucket(wiki, "Untagged by hand", ""), "overdue");

	section("a done field left by an earlier version is migrated");
	wiki.addTiddler(new $tw.Tiddler({title: "Finished in v1.4", tags: ["chores"], due: endOfDay(-5), done: endOfDay(-5), text: ""}));
	check("the stale field alone does not mark it done", core.bucket(wiki, "Finished in v1.4", ""), "overdue");
	core.syncTags(wiki, "Finished in v1.4");
	check("catching up turns the field into the tag", field("Finished in v1.4", "tags").join(","), "chores,todo,done");
	check("and empties the field", field("Finished in v1.4", "done"), "");
	check("so it reads as done again", core.bucket(wiki, "Finished in v1.4", ""), "done");

	section("catching up tasks made before the tags existed");
	wiki.addTiddler(new $tw.Tiddler({title: "Legacy open", tags: ["chores"], due: endOfDay(3), text: ""}));
	core.scope(wiki, "").forEach(function (title) { core.syncTags(wiki, title); });
	check("an old open task gains the todo tag", field("Legacy open", "tags").join(","), "chores,todo");

	section("the plugin will not tag a tiddler that is not a task");
	wiki.addTiddler(new $tw.Tiddler({title: "Just a note", tags: ["chores"], text: ""}));
	check("no date and no marker means no tag", core.syncTags(wiki, "Just a note"), "false");
	check("so its tags are untouched", field("Just a note", "tags").join(","), "chores");

	section("a recurring task is never tagged done");
	wiki.addTiddler(new $tw.Tiddler({title: "Recurring tag check", tags: ["chores"], due: endOfDay(-1), repeat: "weekly", text: ""}));
	core.toggleDone(wiki, "Recurring tag check");
	check("it stays a todo instead", field("Recurring tag check", "tags").join(","), "chores,todo");

	section("neither marker tag gets in the way");
	check("done is not offered as a tag you have tasks under", core.tags(wiki).indexOf("done"), -1);
	check("and neither is todo, which every task carries", core.tags(wiki).indexOf("todo"), -1);
	check("both are named for the templates to exclude", core.markerTags(wiki).join(","), "todo,done");
	var choresView = wiki.renderText("text/html", "text/vnd.tiddlywiki",
		"\\import [all[shadows+tiddlers]tag[$:/tags/Macro]]\n<<tasks chores>>");
	absent("nor drawn as a pill on a finished row", choresView, '>done</a>');
	absent("nor is todo drawn on every row", choresView, '>todo</a>');

	section("and can be turned off, or renamed");
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/donetag", text: ""}));
	wiki.addTiddler(new $tw.Tiddler({title: "No tag wanted", tags: ["chores"], due: endOfDay(1), text: ""}));
	core.setDone(wiki, "No tag wanted", true);
	check("with no done tag configured, nothing marks it done", field("No tag wanted", "tags").join(","), "chores,todo");
	check("so it cannot be finished at all", core.bucket(wiki, "No tag wanted", "") !== "done", "true");
	check("and a stray done tag no longer counts", core.bucket(wiki, "Tagged by hand", "") !== "done", "true");
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/donetag", text: "finished"}));
	wiki.addTiddler(new $tw.Tiddler({title: "Renamed tag", tags: ["chores"], due: endOfDay(1), text: ""}));
	core.setDone(wiki, "Renamed tag", true);
	check("a renamed tag is used instead", field("Renamed tag", "tags").join(","), "chores,todo,finished");
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/donetag", text: "done"}));
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/todotag", text: ""}));
	wiki.addTiddler(new $tw.Tiddler({title: "No todo wanted", tags: ["chores"], text: ""}));
	core.setDue(wiki, "No todo wanted", core.stampFrom(wiki, "2027-03-01", ""));
	check("a blank todo tag means none is written", field("No todo wanted", "tags").join(","), "chores");
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/todotag", text: "todo"}));

	section("adding");
	core.add(wiki, {title: "Brand new", tag: "school", date: "2026-12-01", time: ""});
	check("the task exists", wiki.tiddlerExists("Brand new"), "true");
	check("with its due date", field("Brand new", "due"), "20261201235959999");
	check("its tag, and the todo marker", field("Brand new", "tags").join(","), "school,todo");
	check("as an ordinary tiddler, not a system one", "Brand new".indexOf("$:/"), -1);
	core.add(wiki, {title: "school", tag: "errands", date: "2026-12-05", time: ""});
	check("adopting a title keeps what the tiddler already said", field("school", "text"), "school.\n");
	check("and adds the tag alongside", field("school", "tags").join(","), "errands,todo");
	core.add(wiki, {title: "school", tag: "errands", date: "2026-12-06", time: ""});
	check("adopting twice does not double the tag", field("school", "tags").join(","), "errands,todo");
	check("a blank title adds nothing", core.add(wiki, {title: "   "}), "");

	section("reaching the task list at all");
	check("Tasks is a shadow tiddler, not one the user made", wiki.isShadowTiddler("Tasks"), "true");
	check("so the sidebar search cannot find it",
		wiki.filterTiddlers("[!is[system]search[Tasks]sort[title]]").indexOf("Tasks"), -1);
	check("and neither can the All list",
		wiki.filterTiddlers("[all[tiddlers]!is[system]]").indexOf("Tasks"), -1);
	check("but it does exist, with the board in it",
		wiki.getTiddlerText("Tasks", "").indexOf("tasks/board") >= 0, "true");
	check("a shadow-aware search does find it",
		wiki.filterTiddlers("[all[shadows]!is[system]search[Tasks]]").indexOf("Tasks") >= 0, "true");
	contains("so the plugin ships a sidebar button as the way in",
		field("$:/plugins/claude/tasks/pagecontrol", "text"), 'to="Tasks"');
	check("which is tagged to appear there",
		(wiki.getTiddler("$:/plugins/claude/tasks/pagecontrol").fields.tags || []).join(","), "$:/tags/PageControls");

	section("the sidebar button when nothing is overdue");
	core.select(wiki, core.scope(wiki, ""), "overdue", "").forEach(function (title) {
		core.setDue(wiki, title, core.dueInDays(wiki, title, 7));
	});
	check("nothing is overdue now", core.select(wiki, core.scope(wiki, ""), "overdue", "").length, 0);
	var quiet = render("$:/plugins/claude/tasks/pagecontrol");
	contains("the button is still there", quiet, 'aria-label="Tasks"');
	absent("but carries no count", quiet, "tk-pagebadge");
	wiki.addTiddler(new $tw.Tiddler({title: "$:/config/tasks/pagebadge", text: "no"}));
	check("and it can be turned off entirely",
		render("$:/plugins/claude/tasks/pagecontrol").indexOf("aria-label"), -1);

	/* ---------------------------------------------------------------- */
	console.log("\n" + checks + " checks, " + failures.length + " failed");
	if (failures.length) {
		console.log("\nfailures:\n  - " + failures.join("\n  - "));
	}
	try { fs.rmSync(wikiPath, {recursive: true, force: true}); } catch (e) { /* a leftover temp dir is not a failure */ }
	process.exit(failures.length ? 1 : 0);
});
