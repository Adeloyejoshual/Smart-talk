const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Save user ID to request
    next();
  } catch (err) {
    console.error(err);
    return res.redirect('/login');
  }
};

module.exports = authMiddleware;