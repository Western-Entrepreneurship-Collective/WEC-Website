"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setTaskStatus } from "@/lib/os/actions/work";

export function TaskTick({ id, title, done, updatedAt }: { id: string; title: string; done: boolean; updatedAt: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={`os-tick-round${done ? " is-on" : ""}`}
        aria-pressed={done}
        aria-label={`${done ? "Mark not done" : "Mark done"}: ${title}`}
        disabled={pending}
        onClick={() => start(async () => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("status", done ? "todo" : "done");
          fd.set("expected", updatedAt);
          const result = await setTaskStatus(null, fd);
          setError(result.ok ? null : result.error ?? "That did not work.");
          router.refresh();
        })}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
      </button>
      {error ? <p className="os-form-error os-task-error" role="alert">{error}</p> : null}
    </>
  );
}
