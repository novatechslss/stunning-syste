// BEST-EFFORT limiter: counters live in this serverless instance's memory.
// They reset on cold start and are not shared between instances, so this slows
// casual abuse but is NOT a durable quota. For hard guarantees add a Vercel
// WAF / Firewall rate-limit rule (see README).
const buckets = new Map();

export function rateLimit(key, limit, windowMs, now = Date.now()) {
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
    if (buckets.size > 5000) buckets.clear();
  }
  let b = buckets.get(key);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { allowed: b.count <= limit, limit, remaining: Math.max(0, limit - b.count), resetMs: b.reset - now };
}

export function resetRateLimits() {
  buckets.clear();
}

/** Only trusts proxy-supplied IP headers when explicitly configured (Vercel sets x-vercel-forwarded-for itself). */
export function clientIp(req, cfg) {
  if (cfg.trustedProxy === 'vercel') {
    const v = String(req.headers['x-vercel-forwarded-for'] || '').split(',')[0].trim();
    if (v) return v;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
