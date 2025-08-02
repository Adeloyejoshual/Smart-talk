// middleware/verifyToken.js
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const rawToken = req.headers['authorization'];

  if (!rawToken) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = rawToken.replace(/^Bearer\s+/i, ''); // Remove 'Bearer ' prefix

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    req.userId = decoded.userId || decoded.id; // Support either `userId` or `id`
    next();
  });
}

module.exports = verifyToken;