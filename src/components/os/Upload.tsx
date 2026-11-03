"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmUpload, prepareUpload } from "@/lib/os/actions/work";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx,.pptx";

/** Goes straight to Storage on a one-path signed URL: Server Actions cap at 1 MB. */
export function Upload({ type, entity, accept = ACCEPT, label = "Attach a file", multiple }: { type: "task" | "meeting" | "sop"; entity: string; accept?: string; label?: string; multiple?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    for (const file of files) {
      const prepared = await prepareUpload(type, entity, file.name, file.type, file.size);
      if (!prepared.ok) {
        setError(prepared.error ?? "That file was not accepted.");
        break;
      }
      const put = await fetch(prepared.upload.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file }).catch(() => null);
      if (!put?.ok) {
        setError("The upload did not finish. Try again.");
        break;
      }
      const done = await confirmUpload(prepared.upload.id);
      if (!done.ok) {
        setError(done.error ?? "The upload did not finish.");
        break;
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <label className="os-btn os-btn-ghost os-upload">
        {busy ? "Uploading" : label}
        <input type="file" accept={accept} multiple={multiple} onChange={onChange} disabled={busy} className="sr-only" />
      </label>
      {error ? <p className="os-form-error" role="alert">{error}</p> : null}
    </div>
  );
}
