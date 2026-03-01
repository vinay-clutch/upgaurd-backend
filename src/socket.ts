import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createServer } from 'http';

let io: Server;

export function initSocket(httpServer: any) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  // Setup Redis Subscriber for cross-process communication
  const redisUrl = process.env.REDIS_URL;
  const subscriber = redisUrl ? createClient({ url: redisUrl }) : createClient();
  
  subscriber.on('error', (err) => console.error('Redis Subscribe Error', err));
  
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
