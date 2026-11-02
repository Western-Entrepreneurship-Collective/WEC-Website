import { redirect } from "next/navigation";

// Sending a task to another team is now part of New task. Old links still land there.
export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ project?: string; to?: string }> }) {
  const { project, to } = await searchParams;
  const q = new URLSearchParams();
  if (project) q.set("project", project);
  if (to) q.set("to", to);
  redirect(`/os/tasks/new?${q}`);
}
