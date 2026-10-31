import "server-only";
import { revalidatePath } from "next/cache";
import { RpcError } from "../supabase";
import { Invalid } from "../validate";
import type { ActionResult } from "../types";

/** Wraps every form action: only messages the database wrote for people reach a person. */
export async function run(work: () => Promise<unknown>, message?: string): Promise<NonNullable<ActionResult>> {
  try {
    await work();
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  revalidatePath("/os", "layout");
  return { ok: true, message };
}

export function publicMessage(error: unknown) {
  if (error instanceof Invalid) return error.message;
  if (error instanceof RpcError) {
    if (error.code?.startsWith("P04")) return error.message;
    if (error.code === "23505" || error.code === "23P01") return "That already exists.";
    if (error.code === "23514" || error.code === "22P02" || error.code === "22007") return "One of those values is not allowed.";
    console.error("[os] database error", error.code);
    return "That did not work. Try again.";
  }
  console.error("[os] unexpected error", (error as Error)?.name);
  return "That did not work. Try again.";
}
