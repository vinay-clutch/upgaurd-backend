import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

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
    const dbHost = process.env.DATABASE_URL?.split('@')[1]?.split('/')[0];
    console.log(`📡 Attempting to connect to database: ${dbHost}`);
    await prisma.$connect();
    console.log("✓ Database connected");

    // 2. Test Redis connection (Optional/Non-blocking)
    getRedisClient().catch(() => {});

    // 3. Start Listening
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`🌐 http://localhost:${PORT}`);
    });
  } catch (err: any) {
    console.error("❌ CRITICAL: Failed to start server!");
    console.error("Error Message:", err.message);
    console.error("Error Stack:", err.stack);
    
    if (err.message?.includes('database')) {
      console.error("💡 TIP: Check if DATABASE_URL is correctly set in Railway variables.");
    }
    
    process.exit(1);
  }
}

startServer();
