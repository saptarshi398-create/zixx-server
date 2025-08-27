// Simple in-memory rate limiter middleware
// Not suitable for multi-instance production without shared store

const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 30, keyGenerator } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = (keyGenerator ? keyGenerator(req) : req.ip) || 'unknown';
    let entry = buckets.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
    }
    entry.count += 1;
    buckets.set(key, entry);
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ ok: false, msg: 'Too many requests, please try again later.' });
    }
    next();
  };
}

module.exports = { rateLimit };
