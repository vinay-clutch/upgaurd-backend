import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;

export function createRedisClient() {
    const url = process.env.REDIS_URL;
    const options: any = { 
        url,
        socket: {
            reconnectStrategy: (retries: number) => {
                const delay = Math.min(retries * 50, 2000);
                return delay;
            }
        }
    };

    if (url?.startsWith('rediss://')) {
        options.socket.tls = true;
        options.socket.rejectUnauthorized = false;
    }

    const c = createClient(options);
    c.on("error", (err) => console.error("Redis Error:", err.message));
    return c as RedisClientType;
}

export async function getRedisClient(): Promise<RedisClientType> {
    if (!client) {
        client = createRedisClient();
        try {
            await client.connect();
        } catch (err) {
            console.error("Initial Redis Connection Failed:", err);
            // Don't throw, let the client try to reconnect
        }
    }
    return client;
}

export async function disconnectRedis(): Promise<void> {
    if (client) {
        try {
            await client.quit();
        } catch (_) {
            // ignore
        }
        client = null;
    }
}

type WebsiteEvent = {url: string, id: string}
type MessageType = {
    id: string,
    message: {
        url: string,
        id: string
    }
    //@ts-ignore
}

const STREAM_NAME = "betteruptime:website";

async function xAdd({url, id}: WebsiteEvent) {
    const c = await getRedisClient();
    await c.xAdd(
        STREAM_NAME, '*', {
            url,
            id
        }
    );
}

export async function xAddBulk(websites: WebsiteEvent[]) {
    for (const website of websites) {
        await xAdd({
            url: website.url,
            id: website.id
        })
    }
}

export async function xReadGroup(consumerGroup: string, workerId: string): Promise<MessageType[] | undefined> {
    const c = await getRedisClient();
    // Ensure group exists before attempting to read
    try {
        await c.xGroupCreate(STREAM_NAME, consumerGroup, '$', { MKSTREAM: true });
    } catch (e: any) {
        if (!String(e?.message || '').includes('BUSYGROUP')) {
            throw e;
        }
    }
    const res = await c.xReadGroup(
        consumerGroup, workerId, {
            key: STREAM_NAME,
            id: '>'
        }, {
        'COUNT': 5
        }
    );

    //@ts-ignore
    let messages: MessageType[] | undefined = res?.[0]?.messages;

    return messages;
}

async function xAck(consumerGroup: string, eventId: string) {
    const c = await getRedisClient();
    await c.xAck(STREAM_NAME, consumerGroup, eventId)
}

export async function xAckBulk(consumerGroup: string, eventIds: string[]) {
    eventIds.map(eventId => xAck(consumerGroup, eventId));
}
