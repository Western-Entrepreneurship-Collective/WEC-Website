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
  return {
    windowMs,
    /** Records a hit; true when this key is now over the limit. */
    hit(key: string) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);
      // Keep the map from growing without bound on a long-lived instance.
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every(t => now - t >= windowMs)) hits.delete(k);
      return recent.length > max;
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
