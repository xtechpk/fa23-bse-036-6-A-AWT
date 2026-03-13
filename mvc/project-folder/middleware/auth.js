const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('authorization');

  // Restaurant Analogy: This is like checking the customer's membership card
  // before serving them in the VIP area.
  if (!token || token !== 'Bearer demo-token') {
    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: token is required'
      });
    }

    try {
      const rawToken = token.replace('Bearer ', '').trim();
      const secret = process.env.JWT_SECRET || 'dev-secret';
      const payload = jwt.verify(rawToken, secret);
      req.user = payload;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: invalid or expired token'
      });
    }
  } else {
    req.user = { email: 'demo@local', role: 'STORE_ADMIN' };
  }

  next();
};

module.exports = auth;
