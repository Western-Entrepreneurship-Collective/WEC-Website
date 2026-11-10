/**
 * (No "server-only" marker: it holds no secrets, and the API tests import the
 * routes that use it directly, the same as src/lib/execApplicationsServer.ts.)
 *
 * A small in-memory limiter: at most `max` hits per key in `windowMs`.
 *
 * ⚠️ In memory means per server instance, reset on a cold start. It slows a
 * script down and stops casual guessing; it does not stop a determined attacker
 * spreading requests over many instances. Same trade-off as the exec and rep
 * application forms (src/lib/repApplicationsServer.ts).
 */
export function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  const recent = (key: string, now: number) => (hits.get(key) ?? []).filter(t => now - t < windowMs);
  return {
    windowMs,
    /** True when this key has used its allowance. Records nothing. */
    over(key: string) {
      return recent(key, Date.now()).length >= max;
    },
    /**
     * Records a hit; true when this key is over the limit. A blocked try is not
     * recorded, so "wait 15 minutes" means 15 minutes from the last allowed try,
     * however often someone keeps trying meanwhile.
     */
    hit(key: string) {
      const now = Date.now();
      const list = recent(key, now);
      if (list.length >= max) { hits.set(key, list); return true; }
      list.push(now);
      hits.set(key, list);
      // Keep the map from growing without bound on a long-lived instance.
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every(t => now - t >= windowMs)) hits.delete(k);
      return false;
    },
    /** Forgets a key, for example after a successful login. */
    clear(key: string) {
      hits.delete(key);
    },
  };
}

/** The caller's address, from Vercel's forwarding headers. */
export function ipFrom(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
