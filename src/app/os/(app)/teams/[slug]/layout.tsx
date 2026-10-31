import Link from "next/link";
import { Page } from "@/components/os/ui";
import { TeamTabs } from "./tabs";
import { getTeam } from "./team";

export default async function TeamLayout({ params, children }: { params: Promise<{ slug: string }>; children: React.ReactNode }) {
  const { slug } = await params;
  const { department, canOpen } = await getTeam(slug);
  return (
    <Page eyebrow={canOpen ? "Team" : undefined} title={department.name}>
      {canOpen ? <TeamTabs slug={slug} /> : <nav className="os-crumbs" aria-label="Breadcrumb"><Link href="/os/teams">All Teams</Link></nav>}
      {children}
    </Page>
  );
}
