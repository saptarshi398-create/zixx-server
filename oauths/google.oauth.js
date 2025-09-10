const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Determine the callback URL based on environment
const getCallbackURL = () => {
  let baseUrl;
  if (process.env.NODE_ENV === 'production') {
    baseUrl = process.env.SERVER_URL || 'https://zixx-server.onrender.com/api';
    // baseUrl = process.env.SERVER_URL ;
  } else {
    baseUrl = process.env.SERVER_DEV_URL || 'http://localhost:8282/api';
    // baseUrl = process.env.SERVER_DEV_URL;
  }
  // Ensure no double slashes in the URL
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const callbackUrl = `${cleanBase}/clients/auth/google/callback`;
  return callbackUrl;
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getCallbackURL(),
      proxy: true, // Trust the proxy in production
      passReqToCallback: true // Pass the request to the callback
    },
    (req, accessToken, refreshToken, profile, done) => {
      // Store the returnTo URL from the session if it exists
      const returnTo = req.session.returnTo;
      if (returnTo) {
        profile.returnTo = returnTo;
      }
      return done(null, profile);
    }
  )
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;