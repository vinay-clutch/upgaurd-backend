import { createRedisClient } from '../redis';

let client: any;

async function getClient() {
  if (!client) {
    client = createRedisClient();
    try {
      await client.connect();
    } catch (err) {
      console.error('SocketPublisher Redis connection failed:', err);
    }
  }
  return client;
}

export async function publishSocketEvent(event: string, data: any) {
  try {
    const c = await getClient();
    await c.publish(event, JSON.stringify(data));
  } catch(e) {
    console.error('Failed to publish socket event', e);
  }
}
