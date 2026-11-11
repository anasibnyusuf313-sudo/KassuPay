// STAND-IN for your Day 6 rateLimit middleware (I did not have that file).
// If you already have one, delete this file and import yours in routes/requests.js instead.
//
// NOTE: this keeps counts in memory, so on Vercel each serverless instance counts
// separately. Your Day 6 version may be better (e.g. Redis-backed).

function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // userId -> [timestamps]

  return function (req, res, next) {
    const id = String(req.userId || req.ip);
    const now = Date.now();
    const recent = (hits.get(id) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: message || "Too many requests. Slow down.",
        retryAfter,
      });
    }

    recent.push(now);
    hits.set(id, recent);
    next();
  };
}

module.exports = { rateLimit };
