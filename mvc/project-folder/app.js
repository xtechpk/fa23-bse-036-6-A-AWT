require('dotenv').config();
const express = require('express');
const cors = require('cors');

const logger = require('./middleware/logger');
const auth = require('./middleware/auth');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse JSON request body.
app.use(express.json());
app.use(cors());

// Restaurant Analogy: Middleware is like the waiter who first greets every customer
// and writes down basic order details before sending them to the kitchen.
// We apply logger globally so every request gets logged.
app.use(logger);

// Why express.Router()?
// Instead of putting all routes in app.js, we split them into route modules.
// This keeps code clean, scalable, and easier to maintain as the application grows.

// Product routes: /products
app.use('/products', productRoutes);
app.use('/api/products', productRoutes);

// User routes: /users
// Restaurant Analogy: auth middleware is like a waiter checking membership card/token
// before allowing access to a special section.
app.use('/users', auth, userRoutes);
app.use('/api/users', auth, userRoutes);

// 404 Not Found handler (must be at the end).
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Central error middleware (industry-standard pattern).
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Mini Online Store API is running on http://localhost:${PORT}`);
});
