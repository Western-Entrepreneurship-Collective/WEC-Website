"use client";

// Never shows the underlying error: only that it happened, and a way forward.
export default function OsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="os-page os-notfound">
      <h1>Something went wrong</h1>
      <p>That page could not load. Your work has not been changed.</p>
      <button type="button" className="os-btn os-btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
