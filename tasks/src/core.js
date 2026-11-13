/*\
title: $:/plugins/claude/tasks/core.js
type: application/javascript
module-type: library

Shared model for the task views: reading a due date off a tiddler, placing
it in a bucket relative to now, and the wording that goes with it.

A due date lives in a `due` field, written the way TiddlyWiki writes
`created` and `modified` — a 17 digit UTC stamp, "20261125235959999" — so
that the core date machinery (`sort[due]`, `days:due[]`, `format:date[]`)
understands the field unchanged. Buckets and wording are worked out in
local time, because "today" means the reader's today, not UTC's.

\*/
(function(){
"use strict";

var DUE_FIELD = "due";
var DONE_FIELD = "done";
var START_FIELD = "start";
var REPEAT_FIELD = "repeat";
var PRIORITY_FIELD = "priority";
var LASTDONE_FIELD = "lastdone";
var DONE_TAG_CONFIG = "$:/config/tasks/donetag";
var TODO_TAG_CONFIG = "$:/config/tasks/todotag";
var NOW_TIDDLER = "$:/temp/tasks/now";
var TIME_CONFIG = "$:/config/tasks/defaulttime";
var DAY = 86400000;
var SOON_DAYS = 7;

/* The buckets a view lays out, in the order it lays them out */
var BUCKETS = ["overdue","today","tomorrow","soon","later","someday","deferred","done"];

var CAPTIONS = {
	overdue: "Overdue",
	today: "Today",
	tomorrow: "Tomorrow",
	soon: "This week",
	later: "Later",
	someday: "No due date",
	deferred: "Not started yet",
	done: "Done",
	open: "Open",
	scheduled: "Scheduled",
	all: "All"
};

function local(y,month,d,h,min,s,ms){
	return new Date(y,month - 1,d,h || 0,min || 0,s || 0,ms || 0);
}

/*
23:59:59.999 of a local day. A date with no time on it is read as the end of
that day, so a task due "on the 25th" stays on time until the 25th is over.
*/
function endOfDay(y,month,d){
	return local(y,month,d,23,59,59,999);
}

function valid(date){
	return (date && isFinite(date.getTime())) ? date : null;
}

/*
A due value as a Date, or null for anything unreadable. The field normally
holds a 17 digit stamp, but a date typed in by hand — "2026-11-25",
"20261125", "2026-11-25T09:30" — is read too, so the field survives being
edited in the tiddler editor.
*/
function parseStamp(value){
	var s = String(value || "").trim(), m;
	if(!s){ return null; }
	m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if(m){ return valid(endOfDay(+m[1],+m[2],+m[3])); }
	m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
	if(m){ return valid(local(+m[1],+m[2],+m[3],+m[4],+m[5],+(m[6] || 0))); }
	m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
	if(m){ return valid(endOfDay(+m[1],+m[2],+m[3])); }
	if(!/^\d{9,17}$/.test(s)){ return null; }
	return valid($tw.utils.parseDate(s));
}

function stringify(date){
	return $tw.utils.stringifyDate(date);
}

/* Local midnight starting the day that contains `date` */
function dayStart(date){
	return new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
}

/*
Whole days from one local day to another. Rounding absorbs the hour that a
daylight saving change adds to or takes off a day.
*/
function dayDiff(from,to){
	return Math.round((dayStart(to) - dayStart(from)) / DAY);
}

/* The moment a view is reckoning against: its ticking clock, or right now */
function reference(now){
	return parseStamp(now) || new Date();
}

function dueDate(wiki,title){
	var tiddler = wiki.getTiddler(title);
	return tiddler ? parseStamp(tiddler.fields[DUE_FIELD]) : null;
}

function doneTag(wiki){
	return String(wiki.getTiddlerText(DONE_TAG_CONFIG,"done") || "").trim();
}

function todoTag(wiki){
	return String(wiki.getTiddlerText(TODO_TAG_CONFIG,"todo") || "").trim();
}

/* The two tags the plugin writes, for the places that want to hide them */
function markerTags(wiki){
	return [todoTag(wiki),doneTag(wiki)].filter(function(tag){ return !!tag; });
}

function hasTag(tiddler,tag){
	return !!tag && (tiddler.fields.tags || []).indexOf(tag) !== -1;
}

/* Add and remove tags in one pass; null when nothing needed changing */
function withTags(tiddler,add,remove){
	var tags = (tiddler.fields.tags || []).slice(0), changed = false;
	remove.forEach(function(tag){
		for(var at = tags.indexOf(tag); tag && at !== -1; at = tags.indexOf(tag)){
			tags.splice(at,1);
			changed = true;
		}
	});
	add.forEach(function(tag){
		if(tag && tags.indexOf(tag) === -1){
			tags.push(tag);
			changed = true;
		}
	});
	return changed ? tags : null;
}

/*
Finished means carrying the done tag, and nothing else: there is no field
to disagree with it, and tagging or untagging a tiddler by hand is all it
takes to move a task on or off the list.
*/
function isDone(wiki,title){
	var tiddler = wiki.getTiddler(title);
	return !!tiddler && hasTag(tiddler,doneTag(wiki));
}

/*
Where a task sits relative to `now`. A task is overdue the instant its due
date passes, so a 23:59 deadline stays in "Today" all day and turns red at
midnight.
*/
function bucket(wiki,title,now){
	if(!wiki.getTiddler(title)){ return "someday"; }
	if(isDone(wiki,title)){ return "done"; }
	if(isDeferred(wiki,title,now)){ return "deferred"; }
	var due = dueDate(wiki,title);
	if(!due){ return "someday"; }
	var ref = reference(now);
	if(due.getTime() < ref.getTime()){ return "overdue"; }
	var diff = dayDiff(ref,due);
	if(diff <= 0){ return "today"; }
	if(diff === 1){ return "tomorrow"; }
	if(diff <= SOON_DAYS){ return "soon"; }
	return "later";
}

function caption(wiki,title){
	var tiddler = wiki.getTiddler(title);
	var text = tiddler ? String(tiddler.fields.caption || "").trim() : "";
	return text || title;
}

/*
The date a row shows. The year is left off when it is this one, and the
time only appears when it says something — a bare date is stored as the end
of its day, and "23:59" on every row is noise.
*/
function dueText(wiki,title){
	var due = dueDate(wiki,title);
	if(!due){ return ""; }
	var template = (due.getFullYear() === new Date().getFullYear()) ? "ddd DD mmm" : "ddd DD mmm YYYY";
	var h = due.getHours(), m = due.getMinutes();
	if(!(h === 23 && m === 59) && !(h === 0 && m === 0)){ template += ", 0hh:0mm"; }
	return $tw.utils.formatDateString(due,template);
}

function plural(n,word){
	return n + " " + word + (n === 1 ? "" : "s");
}

/* How far off a due date is, in words: "today", "3 days overdue", "in 2 weeks" */
function relative(wiki,title,now){
	var due = dueDate(wiki,title);
	if(!due){ return ""; }
	var ref = reference(now), diff = dayDiff(ref,due);
	if(diff === 0){ return due.getTime() < ref.getTime() ? "earlier today" : "today"; }
	if(diff === 1){ return "tomorrow"; }
	if(diff === -1){ return "yesterday"; }
	var n = Math.abs(diff);
	var span = (n < 14) ? plural(n,"day") : (n < 60 ? plural(Math.round(n / 7),"week") : plural(Math.round(n / 30),"month"));
	return diff < 0 ? span + " overdue" : "in " + span;
}

var WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
var MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
var UNITS = {day:"day",days:"day",d:"day",week:"week",weeks:"week",w:"week",
	month:"month",months:"month",m:"month",year:"year",years:"year",y:"year"};

/* map[key] would answer "constructor" and the rest of Object's prototype */
function lookup(map,key){
	return Object.prototype.hasOwnProperty.call(map,key) ? map[key] : undefined;
}

function indexOfPrefix(list,word){
	for(var i = 0; i < list.length; i++){
		if(list[i].indexOf(word) === 0 && word.length >= 3){ return i; }
	}
	return -1;
}

/* Midnight today, as a Date to do arithmetic from */
function today(ref){
	var d = ref || new Date();
	return new Date(d.getFullYear(),d.getMonth(),d.getDate());
}

/*
Add months without letting the day of the month run away: one month on from
31 January is the end of February, not the 3rd of March, which is where
plain date arithmetic lands.
*/
function addMonths(date,count){
	var day = date.getDate();
	var shifted = new Date(date.getTime());
	shifted.setDate(1);
	shifted.setMonth(shifted.getMonth() + count);
	var lastDay = new Date(shifted.getFullYear(),shifted.getMonth() + 1,0).getDate();
	shifted.setDate(Math.min(day,lastDay));
	shifted.setHours(date.getHours(),date.getMinutes(),date.getSeconds(),date.getMilliseconds());
	return shifted;
}

function addUnits(date,unit,count){
	if(unit === "month"){ return addMonths(date,count); }
	if(unit === "year"){ return addMonths(date,count * 12); }
	var out = new Date(date.getTime());
	out.setDate(out.getDate() + count * (unit === "week" ? 7 : 1));
	return out;
}

/*
A repeat rule: "weekly", "every 2 weeks", "monthly", "every 3 days". The
weekday is not part of the grammar because it does not need to be -- a
weekly task due on a Monday already recurs on Mondays.
*/
function parseRepeat(value){
	var text = String(value || "").trim().toLowerCase();
	if(!text){ return null; }
	var named = {daily:"day",weekly:"week",fortnightly:"week",monthly:"month",quarterly:"month",yearly:"year",annually:"year"};
	var byName = lookup(named,text);
	if(byName){
		return {count:(text === "fortnightly" ? 2 : (text === "quarterly" ? 3 : 1)),unit:byName};
	}
	var m = /^(?:every\s+)?(\d+)?\s*([a-z]+)$/.exec(text);
	if(!m){ return null; }
	var unit = lookup(UNITS,m[2]);
	if(!unit){ return null; }
	var count = m[1] ? parseInt(m[1],10) : 1;
	if(!(count > 0) || count > 999){ return null; }
	return {count:count,unit:unit};
}

function repeatText(spec){
	if(!spec){ return ""; }
	if(spec.count === 1){ return lookup({day:"daily",week:"weekly",month:"monthly",year:"yearly"},spec.unit) || ""; }
	return "every " + spec.count + " " + spec.unit + "s";
}

function taskRepeat(wiki,title){
	var tiddler = wiki.getTiddler(title);
	return tiddler ? parseRepeat(tiddler.fields[REPEAT_FIELD]) : null;
}

/*
The first occurrence strictly after `after`. A weekly task left untouched
for a month jumps to the next one still to come rather than to another date
already in the past.
*/
function nextOccurrence(from,spec,after){
	var when = new Date(from.getTime());
	/*
	A daily task left alone for years is thousands of steps behind, so cover
	the whole stretch in one stride before stepping. Days and weeks are a
	fixed number of days apart and can be jumped arithmetically; months and
	years cannot, but they are few enough to step.
	*/
	if(spec.unit === "day" || spec.unit === "week"){
		var stride = spec.count * (spec.unit === "week" ? 7 : 1);
		var behind = Math.floor((dayStart(after) - dayStart(when)) / DAY);
		if(behind > 0){ when = addUnits(when,"day",Math.floor(behind / stride) * stride); }
	}
	var guard = 0;
	do {
		when = addUnits(when,spec.unit,spec.count);
		guard++;
	} while(when.getTime() <= after.getTime() && guard < 10000);
	return when;
}

/* "fri", "+3d", "tomorrow 9am", "25 nov", "2026-11-25" as a Date, or null */
function parseNatural(value,now){
	var text = String(value || "").trim().toLowerCase().replace(/\s+/g," ");
	if(!text){ return null; }
	var ref = reference(now), base = today(ref), time = null, m;

	/* peel a trailing time off first: "fri 9am", "tomorrow 14:30" */
	m = /\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(text);
	if(!m){ m = /\s+(?:at\s+)?(\d{1,2}):(\d{2})$/.exec(text); }
	if(m){
		var hours = parseInt(m[1],10), minutes = m[2] ? parseInt(m[2],10) : 0;
		if(m[3] === "pm" && hours < 12){ hours += 12; }
		if(m[3] === "am" && hours === 12){ hours = 0; }
		if(hours <= 23 && minutes <= 59){
			time = {hours:hours,minutes:minutes};
			text = text.slice(0,m.index).trim();
		}
	}

	var at = null;
	if(text === "today" || text === "tonight"){ at = base; }
	else if(text === "tomorrow" || text === "tom"){ at = addUnits(base,"day",1); }
	else if(text === "yesterday"){ at = addUnits(base,"day",-1); }

	/* "+3d", "in 2 weeks", "3 days" */
	if(!at && (m = /^(?:in\s+)?\+?(\d+)\s*([a-z]+)$/.exec(text))){
		var unit = lookup(UNITS,m[2]);
		if(unit){ at = addUnits(base,unit,parseInt(m[1],10)); }
	}

	/* "next week", "next month" */
	if(!at && (m = /^next\s+([a-z]+)$/.exec(text)) && lookup(UNITS,m[1])){
		at = addUnits(base,lookup(UNITS,m[1]),1);
	}

	/* a weekday name: the coming one, today included */
	if(!at && (m = /^(?:(next|this)\s+)?([a-z]+)$/.exec(text))){
		var index = indexOfPrefix(WEEKDAYS,m[2]);
		if(index >= 0){
			var ahead = (index - base.getDay() + 7) % 7;
			if(m[1] === "next" && ahead === 0){ ahead = 7; }
			at = addUnits(base,"day",ahead);
		}
	}

	/* "25 nov", "nov 25", with an optional year */
	if(!at && (m = /^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/.exec(text))){
		var month = indexOfPrefix(MONTHS,m[2]);
		if(month >= 0){ at = monthDay(base,m[3],month,parseInt(m[1],10)); }
	}
	if(!at && (m = /^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/.exec(text))){
		var month2 = indexOfPrefix(MONTHS,m[1]);
		if(month2 >= 0){ at = monthDay(base,m[3],month2,parseInt(m[2],10)); }
	}

	/* "25/11", "25/11/2026" -- day first, as everywhere but the US */
	if(!at && (m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(text))){
		var year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3],10) : parseInt(m[3],10)) : null;
		at = monthDay(base,year,parseInt(m[2],10) - 1,parseInt(m[1],10));
	}

	/* and the forms the field itself uses */
	if(!at){
		var direct = parseStamp(text);
		if(direct){ return direct; }
	}
	if(!at){ return null; }

	var out = new Date(at.getTime());
	if(time){ out.setHours(time.hours,time.minutes,0,0); }
	else { out.setHours(23,59,59,999); }
	return valid(out);
}

/* A day and month, rolled into next year when this year's has gone by */
function monthDay(base,year,month,day){
	if(month < 0 || month > 11 || day < 1 || day > 31){ return null; }
	var out = new Date(year ? parseInt(year,10) : base.getFullYear(),month,day);
	if(out.getMonth() !== month){ return null; }
	if(!year && out.getTime() < base.getTime()){ out.setFullYear(out.getFullYear() + 1); }
	return out;
}

function startDate(wiki,title){
	var tiddler = wiki.getTiddler(title);
	return tiddler ? parseStamp(tiddler.fields[START_FIELD]) : null;
}

/* A task put off until later is not yet anybody's problem */
function isDeferred(wiki,title,now){
	var start = startDate(wiki,title);
	return !!start && start.getTime() > reference(now).getTime();
}

var PRIORITIES = {high:3,h:3,"1":3,medium:2,med:2,m:2,"2":2,normal:2,low:1,l:1,"3":1};
var PRIORITY_NAMES = {"3":"high","2":"medium","1":"low"};

function priorityRank(wiki,title){
	var tiddler = wiki.getTiddler(title);
	if(!tiddler){ return 0; }
	var text = String(tiddler.fields[PRIORITY_FIELD] || "").trim().toLowerCase();
	return lookup(PRIORITIES,text) || 0;
}

function priorityName(wiki,title){
	return lookup(PRIORITY_NAMES,String(priorityRank(wiki,title))) || "";
}

function isSystem(title){
	return title.indexOf("$:/") === 0;
}

/*
The tiddlers a view draws from. With a tag, everything carrying it, so that
tagged-but-unscheduled tiddlers can be offered up for scheduling; without
one, every tiddler that has been given a due date.
*/
function scope(wiki,tag){
	var results = [];
	tag = String(tag || "").trim();
	if(tag){
		wiki.getTiddlersWithTag(tag).forEach(function(title){
			if(!isSystem(title)){ results.push(title); }
		});
		return results;
	}
	var markers = markerTags(wiki);
	wiki.each(function(tiddler,title){
		if(isSystem(title)){ return; }
		var tagged = (tiddler.fields.tags || []).some(function(tag){ return markers.indexOf(tag) !== -1; });
		if(tiddler.fields[DUE_FIELD] || tagged){ results.push(title); }
	});
	return results;
}

/*
Alphabetical, the way the core sort operator does it: case-insensitive and
locale-aware, so an accented letter files with its plain counterpart rather
than after Z. Ties are what reach a comparator at all, so this has to work.
*/
function compare(a,b){
	return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

function byDue(wiki){
	return function(a,b){
		var x = dueDate(wiki,a), y = dueDate(wiki,b);
		var xt = x ? x.getTime() : Infinity, yt = y ? y.getTime() : Infinity;
		if(xt !== yt){ return xt < yt ? -1 : 1; }
		var pa = priorityRank(wiki,a), pb = priorityRank(wiki,b);
		if(pa !== pb){ return pa < pb ? 1 : -1; }
		return compare(caption(wiki,a),caption(wiki,b));
	};
}

function byCaption(wiki){
	return function(a,b){
		return compare(caption(wiki,a),caption(wiki,b));
	};
}

/* The latest deadline first, so the Done list reads newest at the top */
function byDone(wiki){
	return function(a,b){
		var x = dueDate(wiki,a), y = dueDate(wiki,b);
		var xt = x ? x.getTime() : 0, yt = y ? y.getTime() : 0;
		if(xt !== yt){ return xt < yt ? 1 : -1; }
		return byCaption(wiki)(a,b);
	};
}

function matches(wiki,title,want,now){
	if(want === "all"){ return true; }
	if(want === "open"){ return !isDone(wiki,title); }
	if(want === "scheduled"){ return !isDone(wiki,title) && !!dueDate(wiki,title); }
	return bucket(wiki,title,now) === want;
}

/*
The titles from `titles` that belong in `want`, in the order that bucket is
read in: by due date for everything scheduled, alphabetically for the
unscheduled, and newest first for what is finished.
*/
function select(wiki,titles,want,now){
	want = String(want || "open").trim() || "open";
	var results = titles.filter(function(title){ return matches(wiki,title,want,now); });
	if(want === "someday"){ return results.sort(byCaption(wiki)); }
	if(want === "done"){ return results.sort(byDone(wiki)); }
	return results.sort(byDue(wiki));
}

/* Every tag that has a task under it, busiest first */
function tags(wiki){
	var counts = Object.create(null), names = [], skip = markerTags(wiki);
	wiki.each(function(tiddler,title){
		/*
		Asking whether the thing is a task, not whether it has a date: a tag
		whose tasks are all still unscheduled deserves a chip too.
		*/
		if(isSystem(title) || !isTask(wiki,title)){ return; }
		var open = !isDone(wiki,title);
		(tiddler.fields.tags || []).forEach(function(tag){
			if(!tag || isSystem(tag) || skip.indexOf(tag) !== -1){ return; }
			if(!(tag in counts)){ counts[tag] = 0; names.push(tag); }
			if(open){ counts[tag]++; }
		});
	});
	return names.sort(function(a,b){
		if(counts[a] !== counts[b]){ return counts[a] < counts[b] ? 1 : -1; }
		return compare(a,b);
	});
}

function defaultTime(wiki){
	var text = String(wiki.getTiddlerText(TIME_CONFIG,"") || "").trim();
	var m = /^(\d{1,2}):(\d{2})$/.exec(text);
	if(!m || +m[1] > 23 || +m[2] > 59){ return {hours:23,minutes:59}; }
	return {hours:+m[1],minutes:+m[2]};
}

/*
A "YYYY-MM-DD" date and an optional "HH:MM" time as a stamp. A time of
23:59 is pushed out to 23:59:59.999 so that end-of-day really is the end of
the day rather than a minute short of it.
*/
function stampFrom(wiki,date,time){
	var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || "").trim());
	if(!d){ return ""; }
	var fallback = defaultTime(wiki);
	var t = /^(\d{1,2}):(\d{2})/.exec(String(time || "").trim());
	var hours = t ? +t[1] : fallback.hours, minutes = t ? +t[2] : fallback.minutes;
	if(hours > 23 || minutes > 59){ hours = fallback.hours; minutes = fallback.minutes; }
	var endOfIt = (hours === 23 && minutes === 59);
	var when = valid(local(+d[1],+d[2],+d[3],hours,minutes,endOfIt ? 59 : 0,endOfIt ? 999 : 0));
	return when ? stringify(when) : "";
}

/* The local date and time a picker should show for one of a task's date fields */
function pickerValues(wiki,title,field){
	var tiddler = wiki.getTiddler(title);
	var due = tiddler ? parseStamp(tiddler.fields[field || DUE_FIELD]) : null;
	if(!due){ return {date:"",time:""}; }
	return {
		date: $tw.utils.formatDateString(due,"YYYY-0MM-0DD"),
		time: $tw.utils.formatDateString(due,"0hh:0mm")
	};
}

function setField(wiki,title,field,value){
	var tiddler = wiki.getTiddler(title);
	if(!tiddler){ return false; }
	if(String(tiddler.fields[field] || "") === String(value || "")){ return false; }
	var fields = {};
	fields[field] = value;
	wiki.addTiddler(new $tw.Tiddler(tiddler,fields,wiki.getModificationFields()));
	return true;
}

function setDue(wiki,title,stamp){
	var changed = setField(wiki,title,DUE_FIELD,stamp || "");
	if(stamp){ changed = syncTags(wiki,title) || changed; }
	return changed;
}

/* Put a task `days` from today, keeping whatever time of day it already had */
function dueInDays(wiki,title,days){
	var base = new Date();
	var keep = dueDate(wiki,title);
	var when = new Date(base.getFullYear(),base.getMonth(),base.getDate() + (+days || 0),23,59,59,999);
	if(keep){ when.setHours(keep.getHours(),keep.getMinutes(),keep.getSeconds(),keep.getMilliseconds()); }
	return stringify(when);
}

/*
Push a task back by `days` from where it is now. An overdue task is shifted
from today instead, so "+1 day" on a task three weeks late means tomorrow
rather than three weeks ago plus one.
*/
function shiftDue(wiki,title,days){
	var due = dueDate(wiki,title), now = new Date();
	if(!due || due.getTime() < now.getTime()){ return dueInDays(wiki,title,days); }
	var when = new Date(due.getTime());
	when.setDate(when.getDate() + (+days || 0));
	return stringify(when);
}

/*
Something the plugin is entitled to tag: it has one of the date fields on
it, or it is already carrying one of the tags. Without this the todo tag
could be put on any tiddler at all.
*/
function isTask(wiki,title){
	var tiddler = wiki.getTiddler(title);
	if(!tiddler){ return false; }
	return !!(tiddler.fields[DUE_FIELD] ||
		hasTag(tiddler,todoTag(wiki)) || hasTag(tiddler,doneTag(wiki)));
}

/*
The todo tag marks a tiddler as a task, and that does not stop being true
when the task is finished, so it goes on and it stays on. A finished task
carries both tags: todo says what it is, done says where it has got to.

Also migrates the `done` field that earlier versions wrote. The tag has
replaced it, so the field is turned into a tag and cleared -- otherwise a
task finished under an earlier version would read as outstanding again.
*/
function syncTags(wiki,title){
	var tiddler = wiki.getTiddler(title);
	if(!tiddler || !isTask(wiki,title)){ return false; }
	var add = [], remove = [], fields = {}, changed = false;
	var todo = todoTag(wiki);
	if(todo){ add.push(todo); }
	if(String(tiddler.fields[DONE_FIELD] || "").trim()){
		fields[DONE_FIELD] = "";
		changed = true;
		var done = doneTag(wiki);
		if(done){ add.push(done); }
	}
	var tags = withTags(tiddler,add,remove);
	if(tags){
		fields.tags = tags;
		changed = true;
	}
	if(!changed){ return false; }
	wiki.addTiddler(new $tw.Tiddler(tiddler,fields,wiki.getModificationFields()));
	return true;
}

/*
Finish a task, or put it back. Only the done tag moves: todo stays on,
because the tiddler is a task either way.
*/
function setDone(wiki,title,state){
	var tiddler = wiki.getTiddler(title);
	if(!tiddler){ return false; }
	var done = doneTag(wiki), todo = todoTag(wiki);
	var tags = state ? withTags(tiddler,[todo,done],[]) : withTags(tiddler,[todo],[done]);
	if(!tags){ return false; }
	wiki.addTiddler(new $tw.Tiddler(tiddler,{tags:tags},wiki.getModificationFields()));
	return true;
}

/*
Completing a recurring task moves it to its next occurrence rather than
taking it off the list, and notes when that happened. There is no undoing
it -- the date picker is the way back from a mistaken tick.
*/
function completeRepeat(wiki,title){
	var spec = taskRepeat(wiki,title);
	var tiddler = wiki.getTiddler(title);
	if(!spec || !tiddler){ return false; }
	var due = dueDate(wiki,title) || new Date();
	var next = nextOccurrence(due,spec,reference(""));
	var fields = {};
	fields[DUE_FIELD] = stringify(next);
	fields[LASTDONE_FIELD] = stringify(new Date());
	wiki.addTiddler(new $tw.Tiddler(tiddler,fields,wiki.getModificationFields()));
	syncTags(wiki,title);
	return true;
}

function toggleDone(wiki,title){
	if(!isDone(wiki,title) && taskRepeat(wiki,title)){ return completeRepeat(wiki,title); }
	return setDone(wiki,title,!isDone(wiki,title));
}

/*
Make or adopt a task. A title already in the wiki keeps its text and simply
gains the tag and the due date, so scheduling something that exists never
writes over it.
*/
function add(wiki,options){
	options = options || {};
	var title = String(options.title || "").trim();
	if(!title){ return ""; }
	var tag = String(options.tag || "").trim();
	var stamp = options.due ? String(options.due) : stampFrom(wiki,options.date,options.time);
	var existing = wiki.getTiddler(title);
	var tagList = existing ? (existing.fields.tags || []).slice(0) : [];
	if(tag && tagList.indexOf(tag) === -1){ tagList.push(tag); }
	var fields = {title:title,tags:tagList};
	fields[DUE_FIELD] = stamp;
	if(existing){
		wiki.addTiddler(new $tw.Tiddler(existing,fields,wiki.getModificationFields()));
	} else {
		fields.text = "";
		wiki.addTiddler(new $tw.Tiddler(wiki.getCreationFields(),fields,wiki.getModificationFields()));
	}
	syncTags(wiki,title);
	return title;
}

exports.DUE_FIELD = DUE_FIELD;
exports.DONE_FIELD = DONE_FIELD;
exports.START_FIELD = START_FIELD;
exports.REPEAT_FIELD = REPEAT_FIELD;
exports.PRIORITY_FIELD = PRIORITY_FIELD;
exports.parseNatural = parseNatural;
exports.parseRepeat = parseRepeat;
exports.repeatText = repeatText;
exports.taskRepeat = taskRepeat;
exports.nextOccurrence = nextOccurrence;
exports.completeRepeat = completeRepeat;
exports.startDate = startDate;
exports.isDeferred = isDeferred;
exports.priorityRank = priorityRank;
exports.priorityName = priorityName;
exports.setField = setField;
exports.doneTag = doneTag;
exports.todoTag = todoTag;
exports.markerTags = markerTags;
exports.syncTags = syncTags;
exports.isTask = isTask;
exports.NOW_TIDDLER = NOW_TIDDLER;
exports.BUCKETS = BUCKETS;
exports.CAPTIONS = CAPTIONS;
exports.parseStamp = parseStamp;
exports.stringify = stringify;
exports.bucket = bucket;
exports.caption = caption;
exports.dueText = dueText;
exports.relative = relative;
exports.scope = scope;
exports.select = select;
exports.tags = tags;
exports.stampFrom = stampFrom;
exports.pickerValues = pickerValues;
exports.setDue = setDue;
exports.dueInDays = dueInDays;
exports.shiftDue = shiftDue;
exports.isDone = isDone;
exports.setDone = setDone;
exports.toggleDone = toggleDone;
exports.add = add;

})();
