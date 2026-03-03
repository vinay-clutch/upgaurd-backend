import { Server } from 'socket.io';
import { createRedisClient } from './redis';
import { createServer } from 'http';

let io: Server;

export function initSocket(httpServer: any) {
  const allowedOrigins = [
    "https://upgaurd-frontend.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    process.env.CLIENT_URL || 'https://upgaurd-frontend.vercel.app'
  ];

  io = new Server(httpServer, {
    cors: {
      origin: function (origin: any, callback: any) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
  });

  io.on('connection', (socket) => {
    console.log("✅ Client connected:", socket.id);
    socket.on('disconnect', () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  // Setup Redis Subscriber for cross-process communication
  const subscriber = createRedisClient();
  
  subscriber.connect().then(() => {
    subscriber.subscribe('tick_update', (message) => {
      try {
        const data = JSON.parse(message);
        io.emit('tick_update', data);
      } catch(e) {
        console.error('Failed to parse redis message', e);
      }
    });
  });

  return io;
}

export { io };
