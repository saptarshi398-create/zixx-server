const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const getCallbackURL = () => {
  let baseUrl;
  if (process.env.NODE_ENV === 'production') {
    baseUrl = process.env.SERVER_URL;
  } else {
    baseUrl = process.env.SERVER_DEV_URL;
  }
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
      proxy: true,
      passReqToCallback: true
    },
    (req, accessToken, refreshToken, profile, done) => {
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