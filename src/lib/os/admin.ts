import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./config";

/**
 * ⛔ The service key bypasses every row level security policy. It is used for Auth
 * admin calls and for signing Storage URLs, each only AFTER an RPC running as the
 * signed-in user has authorized the request, and by the signed job routes. Never
 * read a table with this client on behalf of a user.
 */
export function createServiceClient() {
  const env = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) throw new Error("WEC OS is not configured");
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function serviceRpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = createServiceClient() as unknown as {
    schema(s: string): { rpc(fn: string, a: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
  };
  const { data, error } = await client.schema("api").rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
