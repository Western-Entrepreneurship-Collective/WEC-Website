"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/os/types";

type Action = (state: ActionResult, formData: FormData) => Promise<ActionResult>;

export function SubmitButton({ children, variant = "primary", name, value }: { children: React.ReactNode; variant?: "primary" | "ghost" | "danger"; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={`os-btn os-btn-${variant}`} disabled={pending} name={name} value={value}>{children}</button>;
}

/** Every write in WEC OS: error shown in place, native dialog for anything destructive. */
export function ActionForm({ action, children, className, confirm, resetOnSuccess, ariaLabel }: {
  action: Action; children: React.ReactNode; className?: string; confirm?: string; resetOnSuccess?: boolean; ariaLabel?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // A ref, not state: the dialog's button submits in the same tick it sets this.
  const confirmed = useRef(false);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      aria-label={ariaLabel}
      onSubmit={event => {
        if (confirm && !confirmed.current) {
          event.preventDefault();
          dialogRef.current?.showModal();
        }
        confirmed.current = false;
      }}
    >
      {children}
      {state?.error ? <p className="os-form-error" role="alert">{state.error}</p> : null}
      {state?.ok && state.message ? <p className="os-form-ok" role="status">{state.message}</p> : null}
      {confirm ? (
        <dialog ref={dialogRef} className="os-dialog">
          <p>{confirm}</p>
          <div className="os-row">
            <button type="button" className="os-btn os-btn-ghost" onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button type="button" className="os-btn os-btn-danger" onClick={() => {
              dialogRef.current?.close();
              confirmed.current = true;
              formRef.current?.requestSubmit();
            }}>Yes, continue</button>
          </div>
        </dialog>
      ) : null}
    </form>
  );
}
