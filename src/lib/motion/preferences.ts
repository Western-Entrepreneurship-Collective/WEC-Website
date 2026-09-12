"use client";

import { useSyncExternalStore } from "react";

const preferenceEvent = "wec-motion-preference";
// Start this version in full motion, including browsers that saved the former
// system-led setting. Only a new, explicit site opt-out disables the experience.
const key = "wec-motion-v2";
let memoryPreference = true;

function snapshot() {
  try { return localStorage.getItem(key) !== "off"; } catch { return memoryPreference; }
}

function subscribe(callback: () => void) {
  window.addEventListener(preferenceEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(preferenceEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useMotionPreference() {
  const enabled = useSyncExternalStore(subscribe, snapshot, () => true);
  function toggle() {
    memoryPreference = !enabled;
    try { localStorage.setItem(key, enabled ? "off" : "on"); } catch { /* The toggle also works when browser storage is unavailable. */ }
    window.dispatchEvent(new Event(preferenceEvent));
  }
  return { enabled, toggle };
}
