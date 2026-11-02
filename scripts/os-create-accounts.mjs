#!/usr/bin/env node
/**
 * Creates WEC OS accounts from a list, each with a random temporary password. Nobody can
 * see anything until they sign in and replace it. The list and the file of passwords hold
 * real names and addresses, and this repository is public, so both must live outside it.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/os-create-accounts.mjs ~/wec-exec-list.csv [--dry-run]
 *
 * The list is a CSV with this header. Position must match a title in the database exactly,
 * and may be empty. Admin is "yes" for anyone who also runs the system.
 *
 *   email,name,position,admin
 *   someone@example.ca,Some One,VP Content,
 *
 * The passwords are written to wec-os-passwords-<time>.csv in your home folder, readable
 * only by you, and never printed. Running it again skips addresses that have an account.
 */
import { randomInt } from "node:crypto";
import { appendFileSync, closeSync, openSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const listPath = args.find(a => !a.startsWith("--"));
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
const repo = resolve(import.meta.dirname, "..");

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (!listPath) stop("Usage: node scripts/os-create-accounts.mjs <list.csv> [--dry-run]");
if (!url || !key) stop("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
const inRepo = path => !relative(repo, resolve(path)).startsWith("..");
if (inRepo(listPath)) stop("Keep the list outside this repository. It is public, and the list holds real names and addresses.");

function parseLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += c;
  }
  cells.push(cell);
  return cells.map(v => v.trim());
}

const lines = readFileSync(listPath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
const header = parseLine(lines[0] ?? "").map(h => h.toLowerCase());
const column = name => header.indexOf(name);
if (column("email") < 0 || column("name") < 0) stop("The first line must be: email,name,position,admin");

const people = lines.slice(1).map((line, i) => {
  const cells = parseLine(line);
  return {
    row: i + 2,
    email: cells[column("email")]?.toLowerCase() ?? "",
    name: cells[column("name")] ?? "",
    position: (column("position") >= 0 && cells[column("position")]) || null,
    admin: column("admin") >= 0 && /^(yes|y|true)$/i.test(cells[column("admin")] ?? ""),
  };
});

const problems = [];
const seen = new Set();
for (const p of people) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) problems.push(`Line ${p.row}: "${p.email}" is not an email address.`);
  if (!p.name) problems.push(`Line ${p.row}: the name is empty.`);
  if (seen.has(p.email)) problems.push(`Line ${p.row}: ${p.email} is listed twice.`);
  seen.add(p.email);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: positions, error: positionsError } = await client.schema("api").rpc("service_position_seats");
if (positionsError) stop(`Could not read the positions: ${positionsError.message}`);
const seats = new Map(positions.map(p => [p.title, p.seat_count]));
for (const p of people) {
  if (p.position && !seats.has(p.position)) problems.push(`Line ${p.row}: no position called "${p.position}".`);
}
const wanted = new Map();
for (const p of people) if (p.position) wanted.set(p.position, (wanted.get(p.position) ?? 0) + 1);
for (const [title, count] of wanted) {
  if (count > (seats.get(title) ?? 0)) problems.push(`${count} people are listed as "${title}", which has ${seats.get(title) ?? 0} seat(s).`);
}
if (problems.length) stop(`Nothing was created. Fix these first:\n  ${problems.join("\n  ")}`);

console.log(`${people.length} account(s) for ${new URL(url).host}.`);
if (dryRun) {
  for (const p of people) console.log(`  ${p.email}  ${p.name}  ${p.position ?? "(no position)"}${p.admin ? "  admin" : ""}`);
  console.log("Dry run: nothing was created.");
  process.exit(0);
}

// No 0, O, 1, l or I, so it can be read off a message and typed.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const temporaryPassword = () => Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
const csv = value => `"${String(value ?? "").replaceAll('"', '""')}"`;

const outPath = join(homedir(), `wec-os-passwords-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
if (inRepo(outPath)) stop("Your home folder is inside this repository, so the passwords have nowhere safe to go.");
// Created unreadable to others, and written a line at a time, so a failure halfway
// loses nothing that already worked.
closeSync(openSync(outPath, "wx", 0o600));
appendFileSync(outPath, "email,name,position,temporary_password\n");

let created = 0;
const skipped = [];
const failed = [];
for (const p of people) {
  const { error: provisionError } = await client.schema("api").rpc("service_provision_account", {
    p_email: p.email, p_full_name: p.name, p_position_title: p.position, p_grant_admin: p.admin,
  });
  if (provisionError?.code === "P0409" && provisionError.message.includes("already has an account")) {
    skipped.push(p.email);
    continue;
  }
  if (provisionError) {
    failed.push(`${p.email}: ${provisionError.message}`);
    continue;
  }
  const password = temporaryPassword();
  const { error: createError } = await client.auth.admin.createUser({ email: p.email, password, email_confirm: true });
  if (createError) {
    failed.push(`${p.email}: ${createError.message}`);
    continue;
  }
  appendFileSync(outPath, `${[p.email, p.name, p.position ?? "", password].map(csv).join(",")}\n`);
  created++;
}

console.log(`Created ${created}. Passwords are in ${outPath}`);
if (skipped.length) console.log(`Already had an account, left alone: ${skipped.join(", ")}`);
if (failed.length) stop(`Not created. Fix these and run it again:\n  ${failed.join("\n  ")}`);
