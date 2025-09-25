const jwt = require("jsonwebtoken");
require("dotenv").config();

const getTokenFromReq = (req) => {
  // Check Authorization header first
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  
  // Then check cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // Finally, check request body (for certain endpoints)
  if (!token && req.body && req.body.token) {
    token = req.body.token;
  }

  // Also accept token passed as query parameter (e.g., ?token=... from redirect)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  return token;
};

const authenticator = (req, res, next) => {
  try {
    const token = getTokenFromReq(req);
    if (!token) {
      console.error('[Auth] No token provided');
      return res.status(401).json({ msg: "Unauthorized: No token", ok: false });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('[Auth] Token verification failed:', err.message);
        // If token is expired, suggest refreshing
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            msg: "Token expired", 
            error: "token_expired",
            ok: false,
            hint: "Please refresh your token or login again"
          });
        }
        return res.status(401).json({ 
          msg: "Unauthorized: Invalid token", 
          error: err.message,
          ok: false 
        });
      }
      
      if (!decoded.userid) {
        console.error('[Auth] Token missing userid');
        return res.status(401).json({ 
          msg: "Invalid token format", 
          error: "missing_userid",
          ok: false 
        });
      }
      
      req.userid = decoded.userid;
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('[Auth] Unexpected error:', error);
    return res.status(500).json({ 
      msg: "Authentication failed", 
      error: error.message,
      ok: false 
    });
  }
};

module.exports = { authenticator, getTokenFromReq };
