const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
// Load env from centralized env directory: ../env/.env[.NODE_ENV]
(() => {
  const baseDir = path.join(__dirname, '..', 'env');
  const specific = process.env.NODE_ENV ? path.join(baseDir, `.env.${process.env.NODE_ENV}`) : null;
  const fallback = path.join(baseDir, '.env');
  const dotenv = require('dotenv');
  if (specific && fs.existsSync(specific)) {
    dotenv.config({ path: specific });
  } else {
    dotenv.config({ path: fallback });
  }
})();
cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET
});
const express = require("express");
const cookieParser = require('cookie-parser');
const { connection } = require("./config/db");
const cors = require("cors");
// path is already imported above
const session = require("express-session");
const ClientsRouters = require('./routes/clients.routes');
const AdminsRouters = require('./routes/admins.routes');
const { autoSeed } = require('./seed/autoSeed');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL ;
const FRONTEND_DEV_URL = process.env.FRONTEND_DEV_URL ;
const ADMIN_CLIENT_URL = process.env.ADMIN_CLIENT_URL ;
let allowedOrigins = [FRONTEND_URL, FRONTEND_DEV_URL, ADMIN_CLIENT_URL].filter(Boolean);
// In non-production, automatically allow common local dev origins so login works via proxy
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins = Array.from(new Set([
    ...allowedOrigins,
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]));
}
const corsOptions = {
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    console.warn("Blocked CORS origin:", origin);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-attempt']
};

// // Debug
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
//   next();
// });

// Parse cookies before anything else
app.use(cookieParser());

// CORS: allow frontend + admin panel with credentials and handle preflight
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Explicit CORS headers safeguard (ensures credentials header is present)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-attempt');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Use JSON parser for all routes except Razorpay webhook, which needs raw body
app.use((req, res, next) => {
  if (req.originalUrl === '/api/clients/payments/razorpay/webhook') return next();
  return express.json()(req, res, next);
});
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// API Routes
app.use("/api", ClientsRouters);
app.use("/api", AdminsRouters);

app.get("/", (req, res) => {
  res.send("WELCOME TO THE ZIXX APP BACKEND");
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(frontendPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// 404 handler for API
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, msg: 'Not found' });
  }
  next();
});

// Error handler
app.use((err, req, res, next) => {
  console.error("API error:", err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ ok: false, msg: err.message || 'Server error' });
  }
  next(err);
});

app.listen(process.env.PORT, async () => {
  try {
    await connection;
    console.log("✅ Server running on PORT", process.env.PORT);
    console.log("✅ Connected to MongoDB");
    console.log("✅ Allowed Origins:", allowedOrigins);
    // Auto-seed only when explicitly enabled: set AUTO_SEED=true
    try {
      const SEED_ENABLED = process.env.AUTO_SEED === 'true';
      if (SEED_ENABLED) {
        await autoSeed();
      } else {
        console.log('[autoSeed] Skipped (set AUTO_SEED=true to enable)');
      }
    } catch (e) {
      console.warn('[autoSeed] error during startup:', e && e.message ? e.message : e);
    }
  } catch (error) {
    console.log("❌ DB Connection Error:", error);
  }
});
