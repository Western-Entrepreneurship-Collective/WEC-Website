"use client";

import { useState } from "react";
import { Arrow } from "./DraftGraphics";
import { siteContent as c } from "@/data/siteContent";

export function Spark({ className = "" }: { className?: string }) {
  return <svg className={`studio-spark ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 0v100M0 50h100M15 15l70 70M15 85l70-70" stroke="currentColor" strokeWidth="12" /></svg>;
}

export function Scribble({ className = "", underline = false }: { className?: string; underline?: boolean }) {
  return <svg className={`scribble ${className}`} viewBox={underline ? "0 0 400 35" : "0 0 240 85"} fill="none" aria-hidden="true"><path d={underline ? "M5 20C115 4 260 25 391 12M18 29c102-15 234-6 323-8" : "M220 19C159-7 34 2 13 32-17 74 147 91 213 59 272 31 184 5 70 17M19 69c53-10 122-6 169-4"} stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

export function StartingNote() {
  const [index, setIndex] = useState(0);
  return <div className="starting-note">
    <div className="starting-note-label"><span className="micro">A starting point</span><span aria-hidden="true">↳</span></div>
    <p id="starting-prompt" aria-live="polite" aria-atomic="true">{c.about.prompts[index]}</p>
    <button onClick={() => setIndex((index + 1) % c.about.prompts.length)} aria-controls="starting-prompt">Try another prompt <Arrow /></button>
  </div>;
}

export function TableSketch() {
  return <svg className="table-sketch" viewBox="0 0 500 340" fill="none" aria-hidden="true">
    <path d="M75 142 248 57l181 86-177 100zM75 142v24l178 102 176-100v-25M110 185v65m287-66v62M251 269v55" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    <path d="m189 114 57-28 53 25-55 30zM189 114v38l55 27v-38M244 179l55-29v-39M117 145l40-19 34 18-37 20zM296 158l40-21 34 17-39 22zM223 213l23-10 28 11" stroke="currentColor" strokeWidth="2" />
    <path d="M160 39c-2-23 29-37 45-17 19 25-13 52-34 34m-10 2-39 24M315 36c0-22 30-28 41-7 11 20-11 43-30 26m11 3 30 19M436 218c-1-24 31-32 42-8 11 23-18 40-32 26m-7 0-20 30M49 219c-12-19-44-5-38 15 6 23 39 15 37-5m4 11 28 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="m375 42 36-20m-11 18 12-19-24 2M66 91 39 73m6 21-8-23 23 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
