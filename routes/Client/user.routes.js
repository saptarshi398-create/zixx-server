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
const isDebug = process.env.DEBUG_LOGS === 'true';

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
      if (isDebug) console.log('Google OAuth callback hit with URL:', req.originalUrl);
      
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
            if (isDebug) console.warn('Invalid returnTo domain:', url.hostname);
            returnTo = process.env.FRONTEND_URL;
          }
        } catch (e) {
          if (isDebug) console.warn('Invalid returnTo URL:', returnTo, e);
          returnTo = process.env.FRONTEND_URL;
        }
        
        req.session.returnTo = returnTo;
      } else {
        const frontendUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.FRONTEND_URL)
          : (process.env.FRONTEND_DEV_URL);
        req.session.returnTo = `${frontendUrl}/auth`;
      }
      
      if (isDebug) console.log('Set returnTo:', req.session.returnTo);
      next();
    } catch (error) {
      console.error('Error in Google OAuth callback setup:', error);
      // Redirect to a safe URL on error based on environment
      const fallbackUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.FRONTEND_URL)
        : (process.env.FRONTEND_DEV_URL);
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
        console.error('Google OAuth error:', err);
        return next(err);
      }
      if (!user) {
        if (isDebug) console.log('Google OAuth failed - no user returned');
        return res.redirect(`/api/clients/auth/google/failed?error=no_user`);
      }
      if (isDebug) console.log('Google OAuth success - user returned:', user);
      // Attach user to request for the next middleware
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const profile = req.user || {};
      const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || '';
      const given = (profile.name && profile.name.givenName) || (profile.displayName || '').split(' ')[0] || '';
      const family = (profile.name && profile.name.familyName) || (profile.displayName || '').split(' ').slice(1).join(' ') || '';
      const avatar = (profile.photos && profile.photos[0] && profile.photos[0].value) || '';
      
      if (!email) {
        console.error('No email provided by Google OAuth');
        return res.redirect(`${process.env.FRONTEND_URL }/auth?error=no_email`);
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
          // Set default role if needed
          role: 'user',
          // Add any other default fields required by your schema
          phone: '',
          gender: '',
          dob: null,
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
          if (isDebug) console.log('Created new user from Google OAuth:', user.email);
        } catch (error) {
          console.error('Error saving new user from Google OAuth:', error);
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
        domain: process.env.NODE_ENV === 'production' ? '.zixx.vercel.app' : undefined
      };

      res.cookie('token', token, cookieOpts);

      // Determine the safe redirect URL based on environment
      let redirectBase = process.env.NODE_ENV === 'production' 
        ? (process.env.FRONTEND_URL )
        : (process.env.FRONTEND_DEV_URL);
      
      // Try to get the returnTo from session if it's a trusted domain
      let returnTo = '';
      if (req.session && req.session.returnTo) {
        try {
          const url = new URL(req.session.returnTo);
          const allowedDomains = [
            'zixx.vercel.app',
            'zixx-admin.vercel.app',
            'localhost:3000',
            'localhost:8080',
            '127.0.0.1:8080'
          ];
          
          if (allowedDomains.some(domain => url.hostname.endsWith(domain))) {
            returnTo = req.session.returnTo;
          }
        } catch (e) {
          if (isDebug) console.warn('Invalid returnTo URL in session:', req.session.returnTo);
        }
      }
      
      // If no valid returnTo in session, use the default frontend URL
      if (!returnTo) {
        redirectBase = redirectBase.replace(/\/$/, '');
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
      if (isDebug) console.log('Redirecting to:', `${url.origin}${url.pathname}?token=[REDACTED]&${url.searchParams.toString().replace(/token=[^&]*&?/, '')}`);
      
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
      console.error('[google-callback] error:', e);
      const FRONTEND = process.env.NODE_ENV === 'production' 
        ? (process.env.FRONTEND_URL )
        : (process.env.FRONTEND_DEV_URL );
      return res.redirect(`${FRONTEND.replace(/\/$/, '')}/auth?error=google_oauth_failed`);
    }
  }
);

// Google OAuth failure -> send user back to frontend /auth with error
UserRouter.get('/auth/google/failed', (req, res) => {
  try {
    const FRONTEND = process.env.NODE_ENV === 'production' 
      ? (process.env.FRONTEND_URL )
      : (process.env.FRONTEND_DEV_URL );
    const dest = `${FRONTEND.replace(/\/$/, '')}/auth?error=google_oauth_failed`;    return res.redirect(dest);
  } catch (e) {
    return res.status(400).json({ ok: false, msg: 'Google OAuth failed' });
  }
});


module.exports = { UserRouter };

