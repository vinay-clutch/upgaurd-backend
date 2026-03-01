import { createClient } from 'redis';

let client: any;

async function getClient() {
  if (!client) {
    const redisUrl = process.env.REDIS_URL;
    client = redisUrl ? createClient({ url: redisUrl }) : createClient();
    client.on('error', (err: any) => console.error('Redis Publisher Error', err));
    await client.connect();
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
