import Link from "next/link";

// The same page for "does not exist" and "not yours to see", inside the workspace.
export default function NotFound() {
  return (
    <div className="os-page os-notfound">
      <h1>Nothing here</h1>
      <p>That page does not exist, or you do not have access to it.</p>
      <Link className="os-btn os-btn-primary" href="/os">Back to your dashboard</Link>
    </div>
  );
}
