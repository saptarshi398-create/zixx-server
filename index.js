const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
// Load env from backend local env files: backend/.env[.NODE_ENV]
(() => {
  const baseDir = __dirname; // backend directory
  const dotenv = require('dotenv');
  const specific = process.env.NODE_ENV ? path.join(baseDir, `.env.${process.env.NODE_ENV}`) : null;
  const fallback = path.join(baseDir, '.env');
  if (specific && fs.existsSync(specific)) {
    dotenv.config({ path: specific });
  } else if (fs.existsSync(fallback)) {
    dotenv.config({ path: fallback });
  } else {
    // No .env found; proceed with process env
  }
})();
// Toggle verbose logs
const isDebug = process.env.DEBUG_LOGS === 'true';
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
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8282',
    'http://127.0.0.1:8282',
  ]));
}
// In production, also include known deployed frontends as a safe fallback
if (process.env.NODE_ENV === 'production') {
  allowedOrigins = Array.from(new Set([
    ...allowedOrigins,
    'https://zixx.vercel.app',
    'https://zixx.in',
    'https://zixx-admin.vercel.app',
    'https://admin.zixx.in',
    'https://zixx-admin-hzavv7qnl-ajay-mondals-projects.vercel.app',
    'https://zixx-admin-*.vercel.app', // Wildcard for preview deployments
  ]));
}

// Allow ops to extend origins at deploy time via env without code changes
const EXTRA_CORS = process.env.CORS_ALLOWED_ORIGINS; // comma-separated list of origins
if (EXTRA_CORS) {
  const extraList = EXTRA_CORS.split(',').map(s => s.trim()).filter(Boolean);
  if (extraList.length) {
    allowedOrigins = Array.from(new Set([...allowedOrigins, ...extraList]));
  }
}

// Derive trusted hostnames from allowed origins, so we can allow both http/https and www/no-www
const urlToHost = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };
let allowedHosts = Array.from(new Set(allowedOrigins.map(urlToHost).filter(Boolean)));
if (process.env.NODE_ENV !== 'production') {
  allowedHosts = Array.from(new Set([...allowedHosts, 'localhost', '127.0.0.1']));
}

const isOriginAllowed = (origin) => {
  if (!origin) return true; // non-browser clients
  try {
    // Check for exact match first
    if (allowedOrigins.includes(origin)) return true;
    
    // Check for wildcard matches (e.g., '*.vercel.app')
    const originHost = new URL(origin).hostname.toLowerCase();
    for (const allowedOrigin of allowedOrigins) {
      if (allowedOrigin.startsWith('https://')) {
        try {
          const allowedHost = new URL(allowedOrigin).hostname;
          if (allowedHost.startsWith('*.')) {
            const domain = allowedHost.substring(2);
            if (originHost.endsWith(domain)) {
              return true;
            }
          }
        } catch (e) {
          // Ignore invalid URLs in allowedOrigins
          continue;
        }
      }
    }
    
    // Check host and host without www
    const host = new URL(origin).hostname.toLowerCase();
    const hostNoWww = host.startsWith('www.') ? host.slice(4) : host;
    return allowedHosts.includes(host) || allowedHosts.includes(hostNoWww);
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: function (origin, cb) {
    if (isOriginAllowed(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-attempt']
};

// // Debug
// app.use((req, res, next) => {
//   next();
// });

// Parse cookies before anything else
app.use(cookieParser());

// Apply CORS with the configured options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Explicit CORS headers safeguard (ensures credentials header is present)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    // Reflect requested headers on preflight to avoid mismatches
    const reqHeaders = req.headers['access-control-request-headers'];
    res.header('Access-Control-Allow-Headers', reqHeaders || 'Content-Type, Authorization, x-refresh-attempt');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Trust the first proxy (Render/Ingress), required for secure cookies and correct protocol detection
app.set('trust proxy', 1);

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
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.NODE_ENV === 'production' ? '.zixx.in' : undefined,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// API Routes
app.use("/api", ClientsRouters);
app.use("/api", AdminsRouters);

app.get("/", (req, res) => {
  res.send("WELCOME TO THE ZIXX APP BACKEND");
});

// Serve frontend in production (only if a build exists or explicitly enabled)
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "..", "frontend", "dist");
  const shouldServe = process.env.SERVE_FRONTEND === 'true' || fs.existsSync(frontendPath);
  if (shouldServe) {
    app.use(express.static(frontendPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(frontendPath, "index.html"));
    });
  } else {
  }
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
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ ok: false, msg: err.message || 'Server error' });
  }
  next();
});

app.listen(process.env.PORT, async () => {
  try {
    await connection;
    console.log("✅ Server running on PORT", process.env.PORT);
    console.log("✅ Connected to MongoDB");
    try {
      const SEED_ENABLED = process.env.AUTO_SEED === 'true';
      if (SEED_ENABLED) {
        await autoSeed();
      }
    } catch (e) {
    }
  } catch (error) {
  }
});
