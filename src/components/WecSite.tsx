"use client";

import { useRef } from "react";
import { Navigation } from "@/components/navigation/Navigation";
import { Hero, About, Experience } from "@/components/sections/Opening";
import { Community, Pillars, Audience, Ecosystem } from "@/components/sections/Collective";
import { Join, Footer } from "@/components/sections/Join";
import { useMotionPreference } from "@/lib/motion/preferences";
import { useSiteMotion } from "@/lib/motion/useSiteMotion";

export function WecSite() {
  const scope = useRef<HTMLDivElement>(null);
  const { enabled, toggle } = useMotionPreference();
  useSiteMotion(scope, enabled);

  return <div ref={scope} className="wec-site" data-motion={enabled ? "full" : "reduced"}><a className="skip-link" href="#main">Skip to content</a><Navigation /><main id="main" tabIndex={-1}><Hero /><About /><Experience /><Community /><Pillars /><Ecosystem /><Audience /><Join /></main><Footer motionEnabled={enabled} toggleMotion={toggle} /></div>;
}
