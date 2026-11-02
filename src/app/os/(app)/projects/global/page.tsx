import { redirect } from "next/navigation";

// Shared projects sit in the one list now. Old links still land there.
export default function GlobalProjectsPage() {
  redirect("/os/projects?scope=all");
}
