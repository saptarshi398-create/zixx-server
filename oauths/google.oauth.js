const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Determine the callback URL based on environment
const getCallbackURL = () => {
  // Prefer explicit SERVER_URL / SERVER_DEV_URL, fall back to BASE_URL or localhost
  const envPreferred = process.env.NODE_ENV === 'production' ? process.env.SERVER_URL : process.env.SERVER_DEV_URL;
  const fallback = process.env.BASE_URL || process.env.SERVER_URL || process.env.SERVER_DEV_URL || 'http://localhost:8080';
  const baseUrl = envPreferred || fallback;

  if (!envPreferred && fallback === 'http://localhost:8080') {
    // Warn in logs so deploys show why default was used — helpful on Render
    console.warn('google.oauth: no SERVER_URL / SERVER_DEV_URL / BASE_URL provided, defaulting to http://localhost:8080');
  }

  // Ensure we always work with a string and strip trailing slashes
  const cleanBase = String(baseUrl).replace(/\/+$/, '');
  const callbackUrl = `${cleanBase}/clients/auth/google/callback`;
  return callbackUrl;
};

// GoogleStrategy initialization is performed below in a guarded function

// Protect startup: only initialize GoogleStrategy when credentials are provided
const _initGoogle = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientID || !clientSecret) {
    console.warn('google.oauth: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Skipping Google OAuth setup.');
    return;
  }

  try {
    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: getCallbackURL(),
          proxy: true,
          passReqToCallback: true
        },
        (req, accessToken, refreshToken, profile, done) => {
          const returnTo = req.session?.returnTo;
          if (returnTo) profile.returnTo = returnTo;
          return done(null, profile);
        }
      )
    );
  } catch (e) {
    console.error('google.oauth: failed to initialize GoogleStrategy', e?.message || e);
  }
};

// Initialize safely
_initGoogle();

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;



