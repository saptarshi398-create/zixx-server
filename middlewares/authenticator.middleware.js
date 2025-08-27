const jwt = require("jsonwebtoken");
require("dotenv").config();

const getTokenFromReq = (req) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
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
