import { createClient } from 'redis';

export async function workerHealthCheck() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  
  const lastHeartbeat = await client.get('worker_heartbeat');
  const now = Date.now();
  
  if (lastHeartbeat && now - parseInt(lastHeartbeat) > 5 * 60 * 1000) {
    console.error('⚠️ Worker has not checked in for 5 minutes!');
    return false;
  }
  
  await client.disconnect();
  return true;
}
