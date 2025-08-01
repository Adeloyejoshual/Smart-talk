// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    req.user = user; // Full user object without password
    next();
  } catch (error) {
    console.error("Authentication Error:", error.message);
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

module.exports = authenticateToken;