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
