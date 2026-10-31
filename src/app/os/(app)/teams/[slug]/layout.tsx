import { Page, Tabs } from "@/components/os/ui";
import { TeamTabs } from "./tabs";
import { getTeam } from "./team";

export default async function TeamLayout({ params, children }: { params: Promise<{ slug: string }>; children: React.ReactNode }) {
  const { slug } = await params;
  const { department, canOpen } = await getTeam(slug);
  return (
    <Page eyebrow="Team" title={department.name}>
      {canOpen ? <TeamTabs slug={slug} /> : <Tabs current="" items={[]} />}
      {children}
    </Page>
  );
}
