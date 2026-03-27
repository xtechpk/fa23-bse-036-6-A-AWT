const path = require('path');
const http = require('http');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const connectDB = require('./config/db');
const createSocketServer = require('./config/socket');
const prisma = require('./utils/prismaClient');
const logger = require('./utils/logger');
const redis = require('./config/redisClient');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const { apiLimiter } = require('./middlewares/rateLimitMiddleware');
const { checkBlockedIp } = require('./middlewares/ipBlockMiddleware');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

const app = express();
let httpServer;
let ioServer;
let shuttingDown = false;

app.set('trust proxy', 1);

// Compress all JSON/text responses — significant bandwidth saving at scale.
app.use(compression({ threshold: 1024 }));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header) and configured browser origins.
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use(checkBlockedIp);
app.use(apiLimiter);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Permission-Based Chat System backend is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  // Connect Redis (non-blocking — app still starts if Redis is unavailable)
  try {
    await redis.connect();
  } catch (err) {
    logger.warn(`[Redis] Could not connect on startup: ${err.message}. Cache will be bypassed.`);
  }

  httpServer = http.createServer(app);
  ioServer = createSocketServer(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(env.port, () => {
      logger.info(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
      resolve();
    });
  });

  return httpServer;
};

const gracefulShutdown = async (reason, exitCode = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.warn(`Shutting down server due to: ${reason}`);

  try {
    if (ioServer) {
      await new Promise((resolve) => ioServer.close(resolve));
    }
  } catch (error) {
    logger.error('Error while closing Socket.IO server', { message: error.message });
  }

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  } catch (error) {
    logger.error('Error while closing HTTP server', { message: error.message });
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error('Error while disconnecting Prisma', { message: error.message });
  }

  try {
    if (redis.isOpen) await redis.quit();
  } catch (error) {
    logger.error('Error while disconnecting Redis', { message: error.message });
  }

  process.exit(exitCode);
};

if (require.main === module) {
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT', 0);
  });

  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM', 0);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { message: error.message, stack: error.stack });
    void gracefulShutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
    void gracefulShutdown('unhandledRejection', 1);
  });

  startServer().catch((error) => {
    logger.error('Failed to start server', { message: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = app;
module.exports.startServer = startServer;
