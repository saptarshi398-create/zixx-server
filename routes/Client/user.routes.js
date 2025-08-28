const express = require("express");
const passport = require("../../oauths/google.oauth");
require("dotenv").config();
const { 
  userRegister, 
  userLogin, 
  getAllUsers, 
  getUserById,
  updateUsersByAdmin,
  deleteUsersByAdmin,
  getCurrentUserInfo,
  validateToken,
  refreshAccessToken,
  logoutUser,
  logoutRedirect,
  updateUser
} = require("../../controllers/user.controler");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { cloudinaryUploadMiddleware, upload } = require("../../middlewares/cloudinaryUpload");
const { UserModel } = require("../../models/users.model");
const jwt = require("jsonwebtoken");

const UserRouter = express.Router();

UserRouter.use(passport.initialize());
UserRouter.use(passport.session());

UserRouter.post("/register", userRegister);

UserRouter.post("/login", userLogin);

UserRouter.get("/user/me", authenticator, getCurrentUserInfo);

UserRouter.get("/users/:id", authenticator, getUserById);

UserRouter.patch("/user/me", authenticator,
  upload.single("profile_pic"),
  cloudinaryUploadMiddleware,
  updateUser
);

UserRouter.get("/validatetoken", authenticator, validateToken);
// Allow refresh without access-token authenticator; it validates refresh token itself
UserRouter.post("/refresh", refreshAccessToken);
// Allow logout to be called without authentication so clients can force cookie removal.
UserRouter.post('/logout', logoutUser);
// also support GET /logout for top-level navigation logout which can clear httpOnly cookies via redirect
UserRouter.get('/logout', logoutRedirect);

// Debug: return cookies and headers (use from browser to see what cookies the browser sends)
UserRouter.get('/debug-cookies', (req, res) => {
  try {
    return res.json({ ok: true, cookies: req.cookies || {}, headers: req.headers });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// =====================
// Google OAuth
// =====================
// Start Google OAuth; store returnTo in session so we can redirect back after callback
UserRouter.get(
  '/auth/google',
  (req, res, next) => {
    try {
      req.session = req.session || {};
      // allow caller to specify desired return URL, default to FRONTEND_URL/auth
      const FRONTEND = (process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || '').replace(/\/$/, '');
      req.session.returnTo = req.query.returnTo || (FRONTEND ? `${FRONTEND}/auth` : undefined);
    } catch {}
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
UserRouter.get(
  '/auth/google/callback',
  (req, res, next) => {
    try {
      // Log the original URL for debugging
      console.log('Google OAuth callback hit with URL:', req.originalUrl);
      
      // Store the returnTo URL from the query parameters in the session
      if (req.query.returnTo) {
        // Make sure the returnTo is a valid URL on our allowed domains
        let returnTo = req.query.returnTo;
        try {
          const url = new URL(returnTo);
          const allowedDomains = [
            'zixx.vercel.app',
            'zixx-admin.vercel.app',
            'localhost:8080',
            'localhost:3000',
            '127.0.0.1:8080'
          ];
          
          if (!allowedDomains.some(domain => url.hostname.endsWith(domain))) {
            console.warn('Invalid returnTo domain:', url.hostname);
            returnTo = process.env.FRONTEND_URL || 'https://zixx.vercel.app';
          }
        } catch (e) {
          console.warn('Invalid returnTo URL:', returnTo, e);
          returnTo = process.env.FRONTEND_URL || 'https://zixx.vercel.app';
        }
        
        req.session.returnTo = returnTo;
      } else {
        const frontendUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.FRONTEND_URL || 'https://zixx.vercel.app')
          : (process.env.FRONTEND_DEV_URL || 'http://localhost:8080');
        req.session.returnTo = `${frontendUrl}/auth`;
      }
      
      console.log('Set returnTo:', req.session.returnTo);
      next();
    } catch (error) {
      console.error('Error in Google OAuth callback setup:', error);
      // Redirect to a safe URL on error
      res.redirect(process.env.FRONTEND_URL || 'https://zixx.vercel.app/auth?error=oauth_failed');
    }
  },
  (req, res, next) => {
    // Custom callback to handle authentication
    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err) {
        console.error('Google OAuth error:', err);
        return next(err);
      }
      if (!user) {
        console.log('Google OAuth failed - no user returned');
        return res.redirect(`/api/clients/auth/google/failed?error=no_user`);
      }
      
      // Attach user to request for the next middleware
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const profile = req.user || {};
      const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || '';
      const given = (profile.name && profile.name.givenName) || (profile.displayName || '');
      const family = (profile.name && profile.name.familyName) || '';
      const avatar = (profile.photos && profile.photos[0] && profile.photos[0].value) || '';

      if (!email) {
        const FRONTEND = (process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || '').replace(/\/$/, '');
        return res.redirect(`${FRONTEND || '/auth'}?error=missing_email`);
      }

      // Find or create user
      let user = await UserModel.findOne({ email });
      if (!user) {
        const randomPass = require('crypto').randomBytes(24).toString('hex');
        user = new UserModel({
          first_name: given || 'Google',
          middle_name: '',
          last_name: family || '',
          email,
          password: randomPass,
          phone: 0,
          dob: 'N/A',
          gender: 'other',
          address: {},
          profile_pic: avatar,
          role: 'customer',
          emailVerified: true,
          isActive: true,
        });
        await user.save();
      }

      // Issue JWT tokens similar to password login
      const token = jwt.sign({ userid: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7h' });
      const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      };

      res.cookie('token', token, { ...cookieOpts, maxAge: 7 * 60 * 60 * 1000 });
      res.cookie('refreshToken', refreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });

      // Determine where to send the user back
      let frontend = process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL;
      try {
        if (!frontend && req.headers.origin) frontend = req.headers.origin;
      } catch {}
      const base = (frontend || '').replace(/\/$/, '') || `http://${req.hostname}:8080`;
      const returnTo = (req.session && req.session.returnTo) || `${base}/auth`;
      try { if (req.session) req.session.returnTo = null; } catch {}

      // Include token in URL as a non-httpOnly fallback for mobile browsers blocking cookies
      const redirectUrl = `${returnTo}${returnTo.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}&provider=google&ok=1`;
      return res.redirect(redirectUrl);
    } catch (e) {
      console.error('[google-callback] error:', e);
      const FRONTEND = (process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || '').replace(/\/$/, '');
      return res.redirect(`${FRONTEND || '/auth'}?error=google_oauth_failed`);
    }
  }
);

// Google OAuth failure -> send user back to frontend /auth with error
UserRouter.get('/auth/google/failed', (req, res) => {
  try {
    const FRONTEND = (process.env.FRONTEND_URL || process.env.FRONTEND_DEV_URL || '').replace(/\/$/, '');
    const dest = FRONTEND ? `${FRONTEND}/auth?error=google_oauth_failed` : '/auth?error=google_oauth_failed';
    return res.redirect(dest);
  } catch (e) {
    return res.status(400).json({ ok: false, msg: 'Google OAuth failed' });
  }
});


module.exports = { UserRouter };

