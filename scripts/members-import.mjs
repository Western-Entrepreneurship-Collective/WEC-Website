#!/usr/bin/env node
/**
 * Turns the Google Sheet of sign ups into SQL that adds them to the member list, once.
 * It never connects to anything: it reads a file and writes files. The Sheet holds real
 * names and addresses, and this repository is public, so the CSV and everything this
 * writes must live outside it.
 *
 *   node scripts/members-import.mjs ~/Downloads/wec-signups.csv
 *
 * Download the Sheet as CSV (File → Download → Comma separated values). Columns are found
 * by their header words, so the question wording does not have to match exactly; the
 * mapping is printed so you can check it. It writes, next to the CSV:
 *
 *   members-import.sql      paste into the Supabase SQL Editor and run. One transaction;
 *                           an email already on the list is skipped, so running it twice
 *                           adds nothing.
 *   members-rejected.csv    rows it could not use, with the reason. Nothing is dropped
 *                           silently. Only written when there are any.
 *
 * Duplicate emails keep the earliest sign up. Timestamps are read as Toronto time.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Graduate", "Alumni"];
const FIELDS = {
  when: /timestamp/i,
  name: /^(?!.*signature).*\bname\b/i,
  email: /e-?mail/i,
  year: /year/i,
  building: /building|curious/i,
  signature: /signature/i,
  evidence: /made|shipped/i,
  favourite: /favou?rite/i,
};
const REQUIRED = ["when", "name", "email", "year", "building", "signature"];

const stop = message => { console.error(message); process.exit(1); };
const csvPath = process.argv[2];
if (!csvPath) stop("Usage: node scripts/members-import.mjs <sheet.csv>");
const inPath = resolve(csvPath);
if (inPath.startsWith(resolve("."))) stop("Keep the CSV outside this repository: it is public.");

// RFC 4180: quoted cells may hold commas, quotes ("") and line breaks.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}

const [header, ...rows] = parseCsv(readFileSync(inPath, "utf8").replace(/^﻿/, ""));
if (!header) stop("The CSV is empty.");

const column = {};
for (const [field, pattern] of Object.entries(FIELDS)) {
  const hits = header.map((h, i) => [h, i]).filter(([h]) => pattern.test(h));
  // "Western email" must not also claim the Year column, and so on: first match wins, once.
  const free = hits.find(([, i]) => !Object.values(column).includes(i));
  if (free) column[field] = free[1];
}
console.log("Columns found:");
for (const field of Object.keys(FIELDS)) console.log(`  ${field.padEnd(10)} ← ${column[field] === undefined ? "(none)" : `"${header[column[field]]}"`}`);
const missing = REQUIRED.filter(f => column[f] === undefined);
if (missing.length) stop(`Missing columns: ${missing.join(", ")}. Rename the header in the CSV and run again.`);

// "9/15/2026 12:03:45" (US locale) or "2026-09-15 12:03:45" (Canada) as Toronto time → an exact instant.
function torontoInstant(text) {
  const us = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const iso = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!us && !iso) return null;
  const [y, mo, d, h, mi, s] = us
    ? [us[3], us[1], us[2], us[4], us[5], us[6] ?? 0].map(Number)
    : [iso[1], iso[2], iso[3], iso[4], iso[5], iso[6] ?? 0].map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  // Toronto's offset at that moment, from the platform's time zone data.
  const local = new Date(new Date(asUtc).toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const utc = new Date(new Date(asUtc).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc + (utc - local)).toISOString();
}

const get = (row, field) => (column[field] === undefined ? "" : (row[column[field]] ?? "")).trim();
const byEmail = new Map();
const rejected = [];
for (const [index, row] of rows.entries()) {
  const line = index + 2;
  const r = Object.fromEntries(Object.keys(FIELDS).map(f => [f, get(row, f)]));
  r.email = r.email.toLowerCase();
  r.year = YEARS.find(y => y.toLowerCase() === r.year.toLowerCase()) ?? r.year;
  const joined = torontoInstant(r.when);
  const reason =
    !joined ? `timestamp "${r.when}" is not M/D/YYYY H:MM:SS or YYYY-MM-DD H:MM:SS`
    : !r.name ? "no name"
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ? "email does not look like an email"
    : !YEARS.includes(r.year) ? `year "${r.year}" is not one of ${YEARS.join(", ")}`
    : null;
  if (reason) { rejected.push([line, reason]); continue; }
  const earlier = byEmail.get(r.email);
  if (earlier && earlier.joined <= joined) { rejected.push([line, `duplicate of line ${earlier.line}`]); continue; }
  if (earlier) rejected.push([earlier.line, `duplicate of line ${line}`]);
  byEmail.set(r.email, { ...r, joined, line });
}

const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const values = [...byEmail.values()]
  .sort((a, b) => a.joined.localeCompare(b.joined))
  .map(r => `  (${[r.name.slice(0, 200), r.email, r.year, r.building.slice(0, 2000), r.signature.slice(0, 200),
    r.evidence.slice(0, 2000), r.favourite.slice(0, 2000)].map(sql).join(", ")}, 'sheet_import', ${sql(r.joined)})`);

if (!values.length) stop(`No usable rows. ${rejected.length} rows were rejected; fix the CSV and run again.`);
const outDir = dirname(inPath);
const sqlPath = join(outDir, "members-import.sql");
writeFileSync(sqlPath, [
  `-- ${values.length} members from ${inPath.split(/[\\/]/).pop()}, made ${new Date().toISOString()}.`,
  "-- Run once in the Supabase SQL Editor. Emails already on the list are skipped.",
  "begin;",
  "insert into members.members (name, email, year, building, signature, evidence, favourite, source, joined_at) values",
  values.join(",\n"),
  "on conflict (email) do nothing;",
  "select count(*) as members_now from members.members;",
  "commit;",
  "",
].join("\n"));

console.log(`\n${rows.length} rows read, ${values.length} members to import, ${rejected.length} not used.`);
console.log(`SQL: ${sqlPath}`);
if (rejected.length) {
  const rejPath = join(outDir, "members-rejected.csv");
  writeFileSync(rejPath, ["line,reason", ...rejected.sort((a, b) => a[0] - b[0]).map(([l, why]) => `${l},"${why.replaceAll('"', '""')}"`)].join("\n") + "\n");
  console.log(`Not used, with reasons: ${rejPath}`);
}
