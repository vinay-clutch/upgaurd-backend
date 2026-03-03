import { createRedisClient } from '../redis';

export async function workerHealthCheck() {
  const client = createRedisClient();
  try {
    await client.connect();
    
    const lastHeartbeat = await client.get('worker_heartbeat');
    const now = Date.now();
    
    if (lastHeartbeat && now - parseInt(lastHeartbeat) > 5 * 60 * 1000) {
      console.error('⚠️ Worker has not checked in for 5 minutes!');
      return false;
    }
    
    await client.disconnect();
    return true;
  } catch (err) {
    console.error('Worker health check failed:', err);
    return false;
  }
}
