// middleware/verifyToken.js
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const rawToken = req.headers['authorization'];
  if (!rawToken) return res.status(401).json({ message: 'No token provided' });

  const token = rawToken.replace(/^Bearer\s+/i, ''); // remove Bearer if present

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
}

module.exports = verifyToken;