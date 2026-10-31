import type { Metadata } from "next";
import { Page } from "@/components/os/ui";
import { requireAdmin } from "@/lib/os/dal";
import { AdminTabs } from "./tabs";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Administration · WEC OS" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <Page eyebrow="System" title="Administration"><AdminTabs />{children}</Page>;
}
