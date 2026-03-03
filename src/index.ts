import app from './app';
import { createServer } from 'http';
import { initSocket } from './socket';
import prisma from './lib/db';
import { getRedisClient } from './redis';

const httpServer = createServer(app);
initSocket(httpServer);

const PORT = Number(process.env.PORT) || 8080;

async function startServer() {
  try {
    // 1. Test Database connection
    await prisma.$connect();
    console.log("✓ Database connected");

    // 2. Test Redis connection (Optional/Non-blocking)
    getRedisClient().catch(() => {});

    // 3. Start Listening
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`🌐 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
