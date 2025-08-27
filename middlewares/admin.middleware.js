const jwt = require("jsonwebtoken");
const { getTokenFromReq } = require("./authenticator.middleware");

exports.adminMiddleware = (req, res, next) => {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ message: "Unauthorized: No token" });

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
