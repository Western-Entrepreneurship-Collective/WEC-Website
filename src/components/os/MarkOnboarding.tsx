"use client";

import { useEffect } from "react";
import { markOnboarding } from "@/lib/os/actions/work";

/** Ticks a first-day step when someone actually reaches the page. A failure just leaves it unticked. */
export function MarkOnboarding({ step }: { step: string }) {
  useEffect(() => {
    markOnboarding(step).catch(() => {});
  }, [step]);
  return null;
}
