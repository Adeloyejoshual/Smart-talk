// middleware/verifyToken.js
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const rawToken = req.headers["authorization"];
  if (!rawToken) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = rawToken.replace(/^Bearer\s+/i, "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id || decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
}

module.exports = verifyToken;