import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Page, Panel } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { entityHref } from "@/lib/os/format";
import { rpc } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Search" };

type Hit = { item_type: string; item_id: string; title: string; snippet: string; archived: boolean };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireMe();
  const { q = "" } = await searchParams;
  const hits = q.trim().length >= 2 ? await rpc<Hit[]>("search", { p_query: q.slice(0, 200) }) : [];
  return (
    <Page title="Search">
      <form action="/os/search" role="search" className="os-inline-form">
        <label className="os-field"><span>Search everything you have access to</span><input name="q" type="search" defaultValue={q} autoFocus /></label>
        <button className="os-btn os-btn-primary" type="submit">Search</button>
      </form>
      <Panel>
        {q.trim().length < 2 ? <Empty>Type at least two characters.</Empty> : hits.length === 0 ? <Empty>No results.</Empty> : (
          <ul className="os-list">
            {hits.map(h => <li key={h.item_type + h.item_id}><span><span className="os-tag">{h.item_type}</span><Link href={entityHref(h.item_type, h.item_id) ?? "/os"}>{h.title}</Link>{h.archived ? <span className="os-tag">Archived</span> : null}{h.snippet ? <small className="os-muted os-block">{h.snippet}</small> : null}</span></li>)}
          </ul>
        )}
      </Panel>
    </Page>
  );
}
