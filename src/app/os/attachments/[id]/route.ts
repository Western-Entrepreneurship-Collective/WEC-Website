import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/os/admin";
import { rpc } from "@/lib/os/supabase";

// The check runs as the signed-in person; only then does the service key sign a
// URL, good for one minute. Permanent file links do not exist.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const rows = await rpc<{ storage_path: string; file_name: string }[]>("attachment_path", { p_id: id }).catch(() => []);
  const file = rows[0];
  if (!file) notFound();
  // Photos can show on a page. Everything else only ever downloads.
  const view = new URL(request.url).searchParams.has("view") && /\.(png|jpe?g|webp)$/i.test(file.file_name);
  const { data, error } = await createServiceClient().storage.from("os-attachments").createSignedUrl(file.storage_path, 60, view ? undefined : { download: file.file_name });
  if (error || !data) notFound();
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "no-store" } });
}
