const express = require('express');
const { listTestimonials, createTestimonial } = require('../../controllers/testimonials.controller');
const { authenticator } = require('../../middlewares/authenticator.middleware');

const TestimonialsRouter = express.Router();

// Rate limiting for testimonial submissions
let rateLimit = null;
(() => {
  try {
    const expressRateLimit = require('express-rate-limit');
    // Try Redis store if REDIS_URL provided and rate-limit-redis is installed
    let storeOption = undefined;
    if (process.env.REDIS_URL) {
      try {
        const { RedisStore } = require('rate-limit-redis');
        const { createClient } = require('redis');
        const redisClient = createClient({ url: process.env.REDIS_URL });
        redisClient.connect().catch(() => {});
        storeOption = new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) });
      } catch (_) {
        // ignore, will fallback to memory store
      }
    }
    rateLimit = expressRateLimit({
      windowMs: 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) =>
        (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
        req.ip ||
        req.connection?.remoteAddress ||
        'unknown',
      message: { ok: false, msg: 'Too many requests. Please try again later.' },
      store: storeOption,
    });
  } catch (e) {
    // Fallback simple in-memory limiter
    const submissionWindowMs = 60 * 1000; // 1 minute
    const submissionLimit = 3; // max 3 per minute per IP
    const submissionStore = new Map(); // ip -> { count, ts }
    rateLimit = function (req, res, next) {
      const now = Date.now();
      const ip =
        (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
        req.ip ||
        req.connection?.remoteAddress ||
        'unknown';
      const rec = submissionStore.get(ip) || { count: 0, ts: now };
      if (now - rec.ts > submissionWindowMs) {
        rec.count = 0;
        rec.ts = now;
      }
      rec.count += 1;
      submissionStore.set(ip, rec);
      if (rec.count > submissionLimit) {
        return res.status(429).json({ ok: false, msg: 'Too many requests. Please try again later.' });
      }
      next();
    };
  }
})();

// Public list
TestimonialsRouter.get('/testimonials', listTestimonials);

// Allow both authenticated and anonymous submission; if authenticated, authenticator will attach userid
TestimonialsRouter.post('/testimonials', rateLimit, authenticatorOptional, createTestimonial);

// Optional authenticator that doesn't error when no token is provided
function authenticatorOptional(req, res, next) {
  // Try authenticator; if it fails due to no token, continue as guest
  const maybeNext = () => next();
  const mockedRes = {
    status: (code) => ({ json: (obj) => maybeNext() }),
  };
  try {
    return authenticator(req, mockedRes, next);
  } catch (e) {
    return next();
  }
}

module.exports = { TestimonialsRouter };
