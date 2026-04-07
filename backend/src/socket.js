const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('join-scan', (domainId) => {
      socket.join(`scan:${domainId}`);
      console.log(`Socket ${socket.id} joined scan room: ${domainId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    // This is just a fallback for when io isn't initialized yet
    // but in reality it should be initialized by the server.
    return null;
  }
  return io;
};

module.exports = { initSocket, getIO };
