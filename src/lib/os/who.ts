import "server-only";
import { can, getDepartments } from "./dal";
import { getSeats } from "./org";
import type { Me } from "./types";
import type { Who } from "@/components/os/TaskComposer";

/**
 * The Who? list: me, my teammates, then other teams. The sentence under the form says what
 * will happen, so nobody has to know that a task for another team waits for its VP.
 */
export async function getWho(me: Me): Promise<Who[]> {
  const [seats, departments] = await Promise.all([getSeats(), getDepartments()]);
  const mine = new Set(me.positions.map(p => p.department_id));
  const myTeam = departments.find(d => mine.has(d.id))?.name ?? "You";
  const presidentHere = seats.some(s => s.orgRole === "president" && s.name);
  const people: Who[] = [{ value: "me", label: "Me", group: myTeam, outcome: "This goes straight onto your task list.", button: "Create task" }];
  if (can(me, "task.assign")) {
    const seen = new Set([me.id]);
    for (const s of seats) {
      if (!s.execId || !s.name || !mine.has(s.departmentId) || seen.has(s.execId)) continue;
      seen.add(s.execId);
      people.push({ value: `p:${s.execId}`, label: s.name, group: departments.find(d => d.id === s.departmentId)?.name ?? myTeam, outcome: `This goes straight onto ${s.name.split(" ")[0]}'s task list.`, button: "Create task" });
    }
  }
  if (!can(me, "request.create") || mine.size === 0) return people;
  const teams: Who[] = departments.filter(d => !mine.has(d.id)).map(d => {
    const lead = seats.find(s => s.departmentId === d.id && s.isHead)?.name;
    const chooser = lead ?? (presidentHere ? `The President, since ${d.name} has no VP right now,` : "Its next VP");
    return { value: `t:${d.id}`, label: d.name, group: "Another team", outcome: `${chooser} will choose who does this. ${d.name} sees this task and the project's name, and nothing else in the project.`, button: `Send to ${d.name}` };
  });
  return [...people, ...teams];
}

