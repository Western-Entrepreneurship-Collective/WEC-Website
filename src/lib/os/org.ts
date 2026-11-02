import "server-only";
import { cache } from "react";
import { displayName } from "./dal";
import { torontoDateKey } from "./format";
import { createClient } from "./supabase";

export type Seat = {
  key: string; departmentId: string; positionId: string; title: string; orgRole: string; isHead: boolean;
  execId: string | null; name: string | null; acting: boolean;
};

const ROLE_ORDER: Record<string, number> = { president: 0, vp: 1, director: 2, coordinator: 3 };

/** Every seat at WEC with who holds it today. Open seats are rows too, because people need to see them. */
export const getSeats = cache(async (): Promise<Seat[]> => {
  const supabase = await createClient();
  const [{ data: departments }, { data: positions }, { data: rows }] = await Promise.all([
    supabase.from("departments").select("id, head_position_id").is("archived_at", null),
    supabase.from("positions").select("id, department_id, title, org_role, seat_count").is("archived_at", null),
    supabase.from("position_assignments").select("position_id, seat_no, during, is_acting, executives!position_assignments_executive_id_fkey(id, full_name, preferred_name, status)"),
  ]);
  const today = torontoDateKey(new Date());
  const holders = (rows ?? []).filter(r => {
    const upper = String(r.during).split(",")[1]?.replace(/[)\]]/, "");
    return r.executives?.status === "active" && (!upper || upper > today);
  });
  const heads = new Set((departments ?? []).map(d => d.head_position_id));
  return (positions ?? [])
    .sort((a, b) => (ROLE_ORDER[a.org_role] ?? 9) - (ROLE_ORDER[b.org_role] ?? 9))
    .flatMap(p => Array.from({ length: p.seat_count }, (_, i) => {
      const h = holders.find(x => x.position_id === p.id && x.seat_no === i + 1);
      return {
        key: `${p.id}:${i + 1}`, departmentId: p.department_id, positionId: p.id, title: p.title, orgRole: p.org_role, isHead: heads.has(p.id),
        execId: h?.executives?.id ?? null, name: h?.executives ? displayName(h.executives) : null, acting: h?.is_acting ?? false,
      };
    }));
});

export const seatHolder = (seats: Seat[], id: string | null | undefined) => (id ? seats.find(s => s.execId === id)?.name ?? null : null);
export const teamLead = (seats: Seat[], departmentId: string | null | undefined) => seats.find(s => s.departmentId === departmentId && s.isHead)?.name ?? null;

// Everything someone holds, for showing a position under their name.
export function titleLookup(seats: Seat[]) {
  return (id: string | null | undefined) => seats.filter(s => s.execId === id && id).map(s => s.title).join(", ");
}
