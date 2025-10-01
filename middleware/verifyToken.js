const jwt = require("jsonwebtoken");

async function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(403).json({ message: "Token has expired. Please re-authenticate." });
      }

      const newToken = await refreshAccessToken(refreshToken);
      if (!newToken) {
        return res.status(403).json({ message: "Failed to refresh token." });
      }

      req.headers["authorization"] = `Bearer ${newToken}`;
      next();
    } else {
      return res.status(403).json({ message: "Invalid token. Please try again." });
    }
  }
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    return newToken;
  } catch (err) {
    return null;
  }
}

module.exports = verifyToken;