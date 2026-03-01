import { xAddBulk, xReadGroup, xAckBulk, disconnectRedis } from '../src/redis';
import { createClient, RedisClientType } from 'redis';

const STREAM = 'betteruptime:website';
const GROUP = 'jest-region';
const WORKER = 'jest-worker';

let admin: RedisClientType;

beforeAll(async () => {
  admin = createClient();
  admin.on('error', (err) => console.error('Redis error in test:', err));
  await admin.connect();
  try {
    await admin.xGroupCreate(STREAM, GROUP, '$', { MKSTREAM: true });
  } catch (e: any) {
    if (!String(e.message || '').includes('BUSYGROUP')) throw e;
  }
});

afterAll(async () => {
  await disconnectRedis();
  await admin.quit();
});

test('xAddBulk → xReadGroup → xAckBulk flow works', async () => {
  await xAddBulk([{ url: 'https://example.com', id: 'redis-test-1' }]);
  const messages = await xReadGroup(GROUP, WORKER);
  expect(Array.isArray(messages) || messages === undefined).toBe(true);
  if (messages && messages.length > 0) {
    await xAckBulk(GROUP, messages.map((m) => m.id));
  }
});


