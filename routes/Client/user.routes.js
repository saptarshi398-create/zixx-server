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
  updateUser,
  changePassword,
  verifyEmail
} = require("../../controllers/user.controler");
const { sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp, resendEmailVerificationForUser } = require("../../controllers/otp.controller");
const { authenticator } = require("../../middlewares/authenticator.middleware");
const { cloudinaryUploadMiddleware, upload } = require("../../middlewares/cloudinaryUpload");
const { UserModel } = require("../../models/users.model");
const jwt = require("jsonwebtoken");

const UserRouter = express.Router();
const isDebug = process.env.DEBUG_LOGS === 'true';

// Helper: resolve a safe frontend base URL with a sensible fallback, and strip trailing slash
const getFrontendBase = () => {
  try {
    const base = (
      (process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : process.env.FRONTEND_DEV_URL) ||
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_DEV_URL 
    );
    return String(base).replace(/\/$/, '');
  } catch {
    return process.env.FRONTEND_DEV_URL;
  }
};

UserRouter.use(passport.initialize());
UserRouter.use(passport.session());

UserRouter.post("/register", userRegister);

UserRouter.post("/login", userLogin);

// OTP routes (no auth)
UserRouter.post('/otp/email/send', sendEmailOtp);
UserRouter.post('/otp/email/verify', verifyEmailOtp);
UserRouter.post('/otp/phone/send', sendPhoneOtp);
UserRouter.post('/otp/phone/verify', verifyPhoneOtp);

// Resend email verification for the authenticated user
UserRouter.post('/user/resend-verification', authenticator, resendEmailVerificationForUser);

// Verify email after OTP validation
UserRouter.post('/user/verify-email', authenticator, verifyEmail);

UserRouter.get("/user/me", authenticator, getCurrentUserInfo);

UserRouter.get("/users/:id", authenticator, getUserById);

UserRouter.patch("/user/me", authenticator,
  upload.single("profile_pic"),
  cloudinaryUploadMiddleware,
  updateUser
);

UserRouter.patch("/user/change-password", authenticator, changePassword);

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
      const FRONTEND = getFrontendBase();
      req.session.returnTo = req.query.returnTo || `${FRONTEND}/auth`;
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
      
      // Always redirect to production frontend after Google auth
      const productionFrontend = 'https://zixx.in';
      req.session.returnTo = `${productionFrontend}/auth`;
      
      // If there's a returnTo in query, append it as a parameter
      if (req.query.returnTo) {
        try {
          const returnTo = req.query.returnTo;
          const url = new URL(returnTo);
          const allowedDomains = [
            'zixx.in',
            'zixx-admin.vercel.app'
          ];
          
          if (allowedDomains.some(domain => url.hostname.endsWith(domain))) {
            req.session.returnTo = `${productionFrontend}/auth?next=${encodeURIComponent(returnTo)}`;
          }
        } catch (e) {
        }
      }
      
      next();
    } catch (error) {
      // Redirect to a safe URL on error based on environment
      const fallbackUrl = getFrontendBase();
      res.redirect(fallbackUrl);
    }
  },
  (req, res, next) => {
    // Custom callback to handle authentication
    passport.authenticate('google', { 
      session: false,
      failureRedirect: '/api/clients/auth/google/failed',
      scope: ['profile', 'email']
    }, (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
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
      const given = (profile.name && profile.name.givenName) || (profile.displayName || '').split(' ')[0] || (email.split('@')[0] || '');
      const family = (profile.name && profile.name.familyName) || (profile.displayName || '').split(' ').slice(1).join(' ') || 'User';
      const avatar = (profile.photos && profile.photos[0] && profile.photos[0].value) || '';
      
      if (!email) {
        const FRONTEND = getFrontendBase();
        return res.redirect(`${FRONTEND}/auth?error=no_email`);
      }

      // Find or create user
      let user = await UserModel.findOne({ email });
      if (!user) {
        // Generate a secure random password for the user
        const randomPass = require('crypto').randomBytes(32).toString('hex');
        
        // Create a username from email if not available
        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
        user = new UserModel({
          email,
          username,
          password: randomPass, // Will be hashed by pre-save hook
          first_name: given,
          last_name: family,
          profile_pic: avatar,
          emailVerified: true,
          isActive: true,
          authProvider: 'google',
          authProviderId: profile.id,
          // Role must match enum ["admin","customer"]
          role: 'customer',
          // Satisfy required fields in schema with safe defaults
          phone: 0,
          gender: 'unspecified',
          dob: '1970-01-01',
          address: {
            personal_address: '',
            shoping_address: '',
            billing_address: '',
            address_village: '',
            landmark: '',
            city: '',
            state: '',
            country: '',
            zip: ''
          }
        });
        
        try {
          await user.save();
        } catch (error) {
          throw new Error('Failed to create user account');
        }
      }

      // Generate JWT token with user data
      const token = jwt.sign(
        { 
          // Use `userid` consistently across the codebase so middleware can read it
          userid: user._id, 
          role: user.role,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: '7d',
          issuer: 'zixx-app',
          audience: 'web-client'
        }
      );

      // Set token in HTTP-only cookie for web clients
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        domain: process.env.NODE_ENV === 'production' ? '.zixx.in' : undefined
      };

      res.cookie('token', token, cookieOpts);

      // Determine the safe redirect URL based on environment
      let redirectBase = getFrontendBase();
      
      // Try to get the returnTo from session if it's a trusted domain
      let returnTo = '';
      if (req.session && req.session.returnTo) {
        try {
          const url = new URL(req.session.returnTo);
          const allowedDomains = [
            'zixx.vercel.app',
            'zixx.in',
            'zixx-admin.vercel.app',
            'localhost:3000',
            'localhost:8080',
            '127.0.0.1:8080'
          ];
          
          if (allowedDomains.some(domain => url.hostname.endsWith(domain))) {
            returnTo = req.session.returnTo;
          }
        } catch (e) {
        }
      }
      
      // If no valid returnTo in session, use the default frontend URL
      if (!returnTo) {
        returnTo = `${redirectBase}/auth`;
      }
      
      // Clear the returnTo from session
      if (req.session) {
        delete req.session.returnTo;
      }
      
      // Build the redirect URL with token as query parameter
      const url = new URL(returnTo);
      url.searchParams.set('token', token);
      url.searchParams.set('provider', 'google');
      url.searchParams.set('ok', '1');
      
      // Preserve the 'next' parameter if it exists in the original URL
      if (req.query.next) {
        url.searchParams.set('next', req.query.next);
      }
      
      // Log the redirect (without the token for security)
      
      // Redirect with security headers
      return res
        .status(302)
        .set({
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        })
        .redirect(url.toString());
    } catch (e) {
      const FRONTEND = getFrontendBase();
      return res.redirect(`${FRONTEND}/auth?error=google_oauth_failed`);
    }
  }
);

// Google OAuth failure -> send user back to frontend /auth with error
UserRouter.get('/auth/google/failed', (req, res) => {
  try {
    const FRONTEND = getFrontendBase();
    const dest = `${FRONTEND}/auth?error=google_oauth_failed`;    return res.redirect(dest);
  } catch (e) {
    return res.status(400).json({ ok: false, msg: 'Google OAuth failed' });
  }
});


module.exports = { UserRouter };

