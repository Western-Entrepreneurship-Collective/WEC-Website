import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { supabaseEnv } from "./config";
import { createClient, rpc } from "./supabase";
import type { Me } from "./types";

// Once per request, however many components ask. api.me reads status live, so a
// deactivated person is turned away on their very next page.
export const getMe = cache(async (): Promise<Me | null> => {
  if (!supabaseEnv()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return rpc<Me | null>("me");
});

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me || me.status !== "active") redirect("/os/login");
  return me;
}

// Not found, not forbidden: an unauthorized person learns nothing, not even that
// the page exists.
export async function requireAdmin(): Promise<Me> {
  const me = await requireMe();
  if (!me.is_admin) notFound();
  return me;
}

export async function requirePresident(): Promise<Me> {
  const me = await requireMe();
  if (!me.is_president) notFound();
  return me;
}

export const can = (me: Me, permission: string) => me.permissions.includes(permission);
export const inDepartment = (me: Me, departmentId: string | null) => me.positions.some(p => p.department_id === departmentId);
export const headsDepartment = (me: Me, departmentId: string | null) => me.positions.some(p => p.department_id === departmentId && p.is_head);
export const displayName = (e: { preferred_name?: string | null; full_name: string }) => e.preferred_name || e.full_name;

export const getDirectory = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("executives").select("id, full_name, preferred_name, email, status").order("full_name");
  return data ?? [];
});

export const getDepartments = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("*").is("archived_at", null).order("sort_order");
  return data ?? [];
});

export function nameLookup(directory: { id: string; full_name: string; preferred_name: string | null }[]) {
  const map = new Map(directory.map(e => [e.id, displayName(e)]));
  return (id: string | null | undefined) => (id ? map.get(id) ?? "Former executive" : "Unassigned");
}
