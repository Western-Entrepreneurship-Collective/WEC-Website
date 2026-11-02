/** Form values, read one way everywhere. The database's constraints are the second check. */
export class Invalid extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function text(fd: FormData, key: string, opts: { max?: number; label?: string; required?: boolean } = {}) {
  const value = String(fd.get(key) ?? "").trim();
  const label = opts.label ?? key;
  if (opts.required !== false && !value) throw new Invalid(`${label} is required.`);
  if (value.length > (opts.max ?? 8000)) throw new Invalid(`${label} is too long.`);
  return value;
}

export const optional = (fd: FormData, key: string, max = 8000) => text(fd, key, { required: false, max }) || null;

export function uuid(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "");
  if (!UUID.test(value)) throw new Invalid("That link is not valid.");
  return value;
}

export function optionalUuid(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "");
  if (!value) return null;
  if (!UUID.test(value)) throw new Invalid("That choice is not valid.");
  return value;
}

export function uuids(fd: FormData, key: string) {
  const values = fd.getAll(key).map(String).filter(Boolean);
  if (values.some(v => !UUID.test(v))) throw new Invalid("That choice is not valid.");
  return values;
}

export const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

// A <input type="datetime-local"> value is wall-clock time in Toronto.
export function dateTime(fd: FormData, key: string, opts: { required?: boolean; label?: string } = {}) {
  const raw = String(fd.get(key) ?? "");
  if (!raw) {
    if (opts.required) throw new Invalid(`${opts.label ?? key} is required.`);
    return null;
  }
  const iso = torontoToIso(raw);
  if (!iso) throw new Invalid(`${opts.label ?? key} is not a valid date.`);
  return iso;
}

// A date with no time means the end of that day in Toronto.
export function dueDate(fd: FormData, key: string) {
  const raw = date(fd, key, "Due date");
  return raw ? torontoToIso(`${raw}T23:59`) : null;
}

export function date(fd: FormData, key: string, label = key) {
  const raw = String(fd.get(key) ?? "");
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) throw new Invalid(`${label} is not a valid date.`);
  return raw;
}

export function torontoToIso(local: string) {
  const asUtc = new Date(`${local.length === 16 ? `${local}:00` : local}Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  // Toronto's offset at that moment, so the same wall clock is stored in any season.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(asUtc);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(asUtc.getTime() + (asUtc.getTime() - shown)).toISOString();
}
