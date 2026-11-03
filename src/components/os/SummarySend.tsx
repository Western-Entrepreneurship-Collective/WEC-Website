"use client";

import { useState } from "react";

type Photo = { id: string; name: string };

/** The steps for sending a summary from someone's own email. The site sends nothing. */
export function SummarySend({ addresses, subject, html, plain, photos }: { addresses: string[]; subject: string; html: string; plain: string; photos: Photo[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function copy(key: string, write: () => Promise<void>) {
    try {
      await write();
      setCopied(key);
      setFailed(false);
    } catch {
      setCopied(null);
      setFailed(true);
    }
  }

  const copyText = (key: string, text: string) => copy(key, () => navigator.clipboard.writeText(text));
  // Keeps the headings where the browser allows it, and plain text where it doesn't.
  const copyEmail = () => copy("email", async () => {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) return navigator.clipboard.writeText(plain);
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    })]);
  });
  // One link at a time. A browser may ask once whether to allow several downloads.
  function downloadPhotos() {
    photos.forEach((photo, i) => setTimeout(() => {
      const link = document.createElement("a");
      link.href = `/os/attachments/${photo.id}`;
      link.click();
    }, i * 400));
    setCopied("photos");
  }

  const steps = [
    { key: "to", title: "Addresses", detail: `All ${addresses.length} executives, for the To line`, button: "Copy addresses", run: () => copyText("to", addresses.join(", ")) },
    { key: "subject", title: "Subject", detail: subject, button: "Copy subject", run: () => copyText("subject", subject) },
    { key: "email", title: "Email", detail: "The summary, with its headings", button: "Copy email", run: copyEmail },
    ...(photos.length ? [{ key: "photos", title: "Photos", detail: `${photos.length} ${photos.length === 1 ? "photo" : "photos"} to attach`, button: "Download photos", run: downloadPhotos }] : []),
  ];

  return (
    <>
      <ol className="os-send-steps">
        {steps.map(step => (
          <li key={step.key}>
            <span><strong>{step.title}</strong><small>{step.detail}</small></span>
            <button type="button" className="os-btn os-btn-ghost" onClick={step.run}>{copied === step.key ? (step.key === "photos" ? "Downloading" : "Copied") : step.button}</button>
          </li>
        ))}
      </ol>
      {failed ? <p className="os-form-error" role="alert">Your browser blocked copying. Select the text in the draft above and copy it yourself.</p> : null}
    </>
  );
}
