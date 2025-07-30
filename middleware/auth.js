// middleware/auth.js
const jwt = require('jsonwebtoken');

// JWT Authentication Middleware
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Remove "Bearer " if included in header
  const cleanToken = token.replace(/^Bearer\s+/i, '');

  jwt.verify(cleanToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Failed to authenticate token' });
    }

    req.userId = decoded.id;
    next();
  });
}

module.exports = verifyToken;