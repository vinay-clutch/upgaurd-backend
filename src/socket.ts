import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: Server;

export function initSocket(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "https://upgaurd-frontend.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    socket.on('join_site_room', (siteId: string) => {
      socket.join(`site:${siteId}`);
      console.log(`📡 Client ${socket.id} joined room: site:${siteId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

export const broadcastToSite = (siteId: string, event: string, data: any) => {
  if (io) {
    io.to(`site:${siteId}`).emit(event, data);
  }
};
