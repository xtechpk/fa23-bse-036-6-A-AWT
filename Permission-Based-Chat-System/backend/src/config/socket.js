const { Server } = require('socket.io');
const env = require('./env');
const { setIO } = require('../services/socketService');
const registerChatSocket = require('../sockets/chatSocket');

const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
    // Tune for high-concurrency workloads.
    pingTimeout: 20000, // ms to wait for pong before declaring a socket dead
    pingInterval: 25000, // ms between server-initiated pings
    upgradeTimeout: 10000, // ms allowed for the WebSocket upgrade handshake
    maxHttpBufferSize: 1e6, // 1 MB max payload per message (prevents memory abuse)
    transports: ['websocket', 'polling'], // prefer WebSocket; fall back to long-polling
  });

  setIO(io);
  registerChatSocket(io);

  return io;
};

module.exports = createSocketServer;
