import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Empty, Page, Panel } from "@/components/os/ui";
import { markAllRead } from "@/lib/os/actions/work";
import { requireMe } from "@/lib/os/dal";
import { entityHref, formatDateTime, notificationText } from "@/lib/os/format";
import { rpc } from "@/lib/os/supabase";
import type { NotificationRow } from "@/lib/os/types";

export const metadata: Metadata = { title: "Inbox" };

export default async function NotificationsPage() {
  await requireMe();
  const rows = await rpc<NotificationRow[]>("my_notifications", { p_limit: 100 });
  return (
    <Page title="Inbox" actions={rows.some(r => !r.read_at) ? <ActionForm action={markAllRead}><SubmitButton variant="ghost">Mark all read</SubmitButton></ActionForm> : null}>
      <Panel>
        {rows.length === 0 ? <Empty>Nothing yet.</Empty> : (
          <ul className="os-list">
            {rows.map(n => {
              const href = entityHref(n.entity_type, n.entity_id);
              return <li key={n.id} className={n.read_at ? undefined : "os-unread"}><span><strong>{notificationText(n.kind)}</strong>: {href ? <Link href={href}>{n.title}</Link> : n.title}</span><span className="os-muted">{formatDateTime(n.created_at)}</span></li>;
            })}
          </ul>
        )}
      </Panel>
    </Page>
  );
}
