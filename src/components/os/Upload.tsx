"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmUpload, prepareUpload } from "@/lib/os/actions/work";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx,.pptx";

/** Goes straight to Storage on a one-path signed URL: Server Actions cap at 1 MB. */
export function Upload({ type, entity }: { type: "task" | "meeting" | "sop"; entity: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    const prepared = await prepareUpload(type, entity, file.name, file.type, file.size);
    if (!prepared.ok) {
      setError(prepared.error ?? "That file was not accepted.");
    } else {
      const put = await fetch(prepared.upload.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file }).catch(() => null);
      if (!put?.ok) {
        setError("The upload did not finish. Try again.");
      } else {
        const done = await confirmUpload(prepared.upload.id);
        if (!done.ok) setError(done.error ?? "The upload did not finish.");
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <label className="os-btn os-btn-ghost os-upload">
        {busy ? "Uploading" : "Attach a file"}
        <input type="file" accept={ACCEPT} onChange={onChange} disabled={busy} className="sr-only" />
      </label>
      {error ? <p className="os-form-error" role="alert">{error}</p> : null}
    </div>
  );
}
