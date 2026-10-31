import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { inDepartment, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

/** A team's workspace opens for its members and the President. Roster details are org-wide. */
export const getTeam = cache(async (slug: string) => {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: department } = await supabase.from("departments").select("*").eq("slug", slug).maybeSingle();
  if (!department) notFound();
  return { me, department, isMember: inDepartment(me, department.id), canOpen: me.is_president || inDepartment(me, department.id) };
});
