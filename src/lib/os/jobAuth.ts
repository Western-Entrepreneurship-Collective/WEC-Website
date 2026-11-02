import "server-only";
import { timingSafeEqual } from "node:crypto";

/** The job routes answer only to the shared secret. With it unset, they answer no one. */
export function jobAuthorized(request: Request) {
  const secret = process.env.WEC_OS_JOBS_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export const jobResponse = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
