// Shown the moment someone clicks to another WEC OS page, while the server is
// still gathering that page's data. The nav stays in place (it is the layout);
// only the page area swaps to this until the real page is ready.
export default function Loading() {
  return (
    <div className="os-page os-loading" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="os-loading-bar os-loading-title" aria-hidden="true" />
      <div className="os-loading-bar os-loading-line" aria-hidden="true" />
      <div className="os-loading-panel" aria-hidden="true">
        <div className="os-loading-bar" />
        <div className="os-loading-bar" />
        <div className="os-loading-bar os-loading-short" />
      </div>
    </div>
  );
}
