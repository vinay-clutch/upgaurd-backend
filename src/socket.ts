import { Server } from 'socket.io';
import { createRedisClient } from './redis';
import { createServer } from 'http';

let io: Server;

export function initSocket(httpServer: any) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "https://upgaurd-frontend.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        process.env.CLIENT_URL || "https://upgaurd-frontend.vercel.app"
      ],
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      // client disconnected
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
