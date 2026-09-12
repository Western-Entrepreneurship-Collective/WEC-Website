"use client";

import { useEffect, type RefObject } from "react";

// Split the animation engine out of the initial render. The complete story is
// server-rendered and remains readable if motion is off or the engine fails.
export function useSiteMotion(scope: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !scope.current) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const root = scope.current;
    import("./story").then(({ setupStory }) => {
      if (!disposed) cleanup = setupStory(root);
    }).catch(error => {
      console.error("WEC motion enhancement could not load; the reading experience is still available.", error);
    });
    return () => { disposed = true; cleanup?.(); };
  }, [enabled, scope]);
}
