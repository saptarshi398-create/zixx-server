const jwt = require("jsonwebtoken");
const { getTokenFromReq } = require("./authenticator.middleware");

exports.adminMiddleware = (req, res, next) => {
  console.log('adminMiddleware debug:', {
    headers: req.headers,
    cookies: req.cookies
  });

  const token = getTokenFromReq(req);
  if (!token) {
    console.error('No token found in request');
    return res.status(401).json({ message: "Unauthorized: No token" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  if (decoded.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  req.userid = decoded.userid;
  req.user = decoded;
  next();
};
