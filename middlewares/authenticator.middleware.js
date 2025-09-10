const jwt = require("jsonwebtoken");
require("dotenv").config();

const getTokenFromReq = (req) => {
  // Only use Authorization header for admin routes
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('No Bearer token in Authorization header');
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('Empty token in Authorization header');
    return null;
  }

  try {
    const decoded = jwt.decode(token);
    console.log('Token payload:', decoded);
  } catch (e) {
    console.error('Failed to decode token:', e.message);
  }
  
  return token;
};

const authenticator = (req, res, next) => {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ msg: "Unauthorized: No token" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ msg: "Unauthorized: Invalid token" });
    req.userid = decoded.userid;
    req.user = decoded;
    next();
  });
};

module.exports = { authenticator, getTokenFromReq };
