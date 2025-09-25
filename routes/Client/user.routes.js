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

const getFrontendBase = () => {
  try {
    const base = (
      (process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : process.env.FRONTEND_DEV_URL) ||
      process.env.FRONTEND_URL ||
      process.env.FRONTEND_DEV_URL
    );
    return String(base).replace(/\/$/, '');
  } catch {
    return process.env.FRONTEND_DEV_URL || "http://localhost:8080";
  }
};

UserRouter.use(passport.initialize());
UserRouter.use(passport.session());

UserRouter.post("/register", userRegister);
UserRouter.post("/login", userLogin);

// OTP routes
UserRouter.post('/otp/email/send', sendEmailOtp);
UserRouter.post('/otp/email/verify', verifyEmailOtp);
UserRouter.post('/otp/phone/send', sendPhoneOtp);
UserRouter.post('/otp/phone/verify', verifyPhoneOtp);

UserRouter.post('/user/resend-verification', authenticator, resendEmailVerificationForUser);
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
UserRouter.post("/refresh", refreshAccessToken);
UserRouter.post('/logout', logoutUser);
UserRouter.get('/logout', logoutRedirect);

// Debug route
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
UserRouter.get(
  '/auth/google',
  (req, res, next) => {
    try {
      req.session = req.session || {};
      const FRONTEND = getFrontendBase();
      req.session.returnTo = req.query.returnTo || `${FRONTEND}/auth`;
    } catch {}
    next();
  },
  (req, res, next) => {
    // Build callback URL dynamically from this request (respects proxies)
    try {
      const xfProto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString();
      const proto = xfProto.split(',')[0].trim();
      const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
      const base = `${proto}://${host}`.replace(/\/+$/, '');
      const callbackURL = `${base}/api/clients/auth/google/callback`;
      if (isDebug) console.log('[oauth] using callbackURL', callbackURL);
      return passport.authenticate('google', { scope: ['profile', 'email'], callbackURL })(req, res, next);
    } catch (e) {
      return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    }
  }
);

UserRouter.get(
  '/auth/google/callback',
  (req, res, next) => {
    try {
      const FRONTEND = getFrontendBase();
      req.session.returnTo = `${FRONTEND}/auth`;
      if (req.query.returnTo) {
        try {
          const returnTo = req.query.returnTo;
          const url = new URL(returnTo);
          const allowedDomains = [
            'zixx.in',
            'zixx-admin.vercel.app',
            'localhost:8080',
            '127.0.0.1:8080'
          ];

          if (allowedDomains.some(domain => url.hostname.endsWith(domain))) {
            req.session.returnTo = `${FRONTEND}/auth?next=${encodeURIComponent(returnTo)}`;
          }
        } catch {}
      }

      next();
    } catch (error) {
      const fallbackUrl = getFrontendBase();
      res.redirect(fallbackUrl);
    }
  },
  (req, res, next) => {
    // Ensure callbackURL override matches the one used when initiating auth
    let callbackURL;
    try {
      const xfProto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString();
      const proto = xfProto.split(',')[0].trim();
      const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
      const base = `${proto}://${host}`.replace(/\/+$/, '');
      callbackURL = `${base}/api/clients/auth/google/callback`;
    } catch {}

    passport.authenticate('google', { 
      session: false,
      failureRedirect: '/api/clients/auth/google/failed',
      scope: ['profile', 'email'],
      ...(callbackURL ? { callbackURL } : {})
    }, (err, user) => {
      if (err) return next(err);
      if (!user) return res.redirect(`/api/clients/auth/google/failed?error=no_user`);
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const profile = req.user || {};
      const email = (profile.emails?.[0]?.value) || '';
      const given = profile.name?.givenName || profile.displayName?.split(' ')[0] || email.split('@')[0] || '';
      const family = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || 'User';
      const avatar = profile.photos?.[0]?.value || '';

      if (!email) {
        const FRONTEND = getFrontendBase();
        return res.redirect(`${FRONTEND}/auth?error=no_email`);
      }

      // Find or create user
      let user = await UserModel.findOne({ email });
      if (!user) {
        const randomPass = require('crypto').randomBytes(32).toString('hex');
        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

        user = new UserModel({
          email,
          username,
          password: randomPass,
          first_name: given,
          last_name: family,
          profile_pic: avatar,
          emailVerified: true,
          isActive: true,
          authProvider: 'google',
          authProviderId: profile.id,
          role: 'customer',
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

        await user.save().catch(() => { throw new Error('Failed to create user account'); });
      } else {
        let shouldUpdate = false;

        if (avatar && (!user.profile_pic || user.profile_pic === '' || user.profile_pic === '/placeholder.svg')) {
          user.profile_pic = avatar;
          shouldUpdate = true;
        }

        if (given && (!user.first_name || user.first_name === 'N/A' || user.first_name === '')) {
          user.first_name = given;
          shouldUpdate = true;
        }

        if (family && (!user.last_name || user.last_name === 'N/A' || user.last_name === '')) {
          user.last_name = family;
          shouldUpdate = true;
        }

        if (!user.authProvider || user.authProvider !== 'google') {
          user.authProvider = 'google';
          user.authProviderId = profile.id;
          shouldUpdate = true;
        }

        if (!user.emailVerified) {
          user.emailVerified = true;
          shouldUpdate = true;
        }

        if (shouldUpdate) await user.save().catch(err => console.error("Update user failed:", err));
      }

      const token = jwt.sign(
        { userid: user._id, role: user.role, email: user.email, first_name: user.first_name, last_name: user.last_name },
        process.env.JWT_SECRET,
        { expiresIn: '7d', issuer: 'zixx-app', audience: 'web-client' }
      );
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: process.env.NODE_ENV === 'production' ? '.zixx.in' : undefined
      };
      res.cookie('token', token, cookieOpts);

      let redirectBase = getFrontendBase();
      let returnTo = '';

      if (req.session?.returnTo) {
        try {
          const url = new URL(req.session.returnTo);
          const allowedDomains = [
            'zixx.vercel.app',
            'zixx.in',
            'admin.zixx.in',
            'zixx-admin.vercel.app',
            'localhost:8080',
            '127.0.0.1:8080',
            'localhost:8000',
            '127.0.0.1:8000',
            'localhost:8282',
            '127.0.0.1:8282'
          ];
          if (allowedDomains.some(domain => url.hostname.endsWith(domain))) {
            returnTo = req.session.returnTo;
          }
        } catch {}
      }

      if (!returnTo){
        if (isDebug) console.log("returnTo not found", req.session.returnTo);
        returnTo = `${redirectBase}/auth`;
      }
      if (req.session) delete req.session.returnTo;

      const url = new URL(returnTo);
      url.searchParams.set('token', token);
      url.searchParams.set('provider', 'google');
      url.searchParams.set('ok', '1');

      if (req.query.next) {
        url.searchParams.set('next', req.query.next);
      }
  if (isDebug) console.log(url.toString());
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

UserRouter.get('/auth/google/failed', (req, res) => {
  const FRONTEND = getFrontendBase();
  return res.redirect(`${FRONTEND}/auth?error=google_oauth_failed`);
});

module.exports = { UserRouter };
