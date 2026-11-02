import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./config";
import type { Database } from "./database.types";

// httpOnly: no browser code ever reads the session, because no browser code talks
// to Supabase. Every call goes through the server with the user's own token, so
// row level security applies to all of it.
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/os",
} as const;

export async function createClient() {
  const env = supabaseEnv();
  if (!env) throw new Error("WEC OS is not configured");
  const store = await cookies();
  return createServerClient<Database, "os">(env.url, env.anonKey, {
    db: { schema: "os" },
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        // Server Components cannot set cookies. proxy.ts has already refreshed the
        // session for this request, so nothing is lost by skipping it here.
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

// Untyped on purpose: the generated argument types cannot express nullable
// parameters, and the database checks every argument anyway.
export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await (supabase.schema("api") as unknown as {
    rpc(fn: string, a: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
  }).rpc(name, args);
  if (error) throw new RpcError(error.code, error.message);
  return data as T;
}

export class RpcError extends Error {
  constructor(public code: string | undefined, message: string) {
    super(message);
  }
}
