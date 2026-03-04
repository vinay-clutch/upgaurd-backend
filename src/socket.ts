import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';

const corsOptions = {
  origin: [
    "https://upgaurd-frontend.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  credentials: true,
  methods: ['GET', 'POST'],
};

export function initSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
}
