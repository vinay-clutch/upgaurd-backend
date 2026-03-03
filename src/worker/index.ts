import https from "https";
import http from "http";
import { URL } from "url";
import { createRedisClient, xAckBulk, xReadGroup } from "../redis";
import prisma from "../lib/db";
import { NotificationService } from "../services/notificationService";
import { recordCheck } from "../services/downtimeTracker";
import dotenv from "dotenv";
import { Resend } from 'resend';
import { publishSocketEvent } from '../services/socketPublisher';

dotenv.config();

setInterval(async () => {
  try {
    const redis = createRedisClient();
    await redis.connect();
    await redis.set('worker_heartbeat', Date.now().toString());
    await redis.disconnect();
  } catch(e) {
    console.error('Heartbeat failed:', e);
  }
}, 60 * 1000);

const resend = new Resend(process.env.Mail_API);
const notificationCache = new Map<string, number>();

const REGION_ID = process.env.REGION_ID!;
const WORKER_ID = process.env.WORKER_ID!;
if (!REGION_ID) throw new Error("Region not provided");
if (!WORKER_ID) throw new Error("worker not provided");


const now = () => process.hrtime.bigint(); // ns
const diffMs = (start?: bigint, end?: bigint) => {
  if (!start || !end) return 0;
  const n = Number(end - start) / 1_000_000;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

async function main() {
  while (true) {
    const items = await xReadGroup(REGION_ID, WORKER_ID);

    if (!items || items.length === 0) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    await Promise.all(
      items.map(({ message }: { message: { url: string; id: string } }) =>
        fetchWebsite(message.url, message.id)
      )
    );

    xAckBulk(
      REGION_ID,
      items.map(({ id }: { id: string }) => id)
    );
  }
}
async function fetchWebsite(url: string, websiteId: string) {
  return new Promise<void>((resolve) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === "https:" ? https : http;

    const agent =
      urlObj.protocol === "https:"
        ? new https.Agent({ keepAlive: false })
        : new http.Agent({ keepAlive: false });

    let t_start: bigint = now();
    let t_socket: bigint | undefined;
    let t_lookup: bigint | undefined;
    let t_connect: bigint | undefined;
    let t_secure: bigint | undefined;
    let t_response: bigint | undefined;
    let t_end: bigint | undefined;

    const req = transport.get(
      url,
      {
        agent,
        headers: { "User-Agent": "UpGuard-Worker/1.0" },
      },
      (res) => {
        res.on("data", () => {}); // drain
        res.on("end", async () => {
          t_end = now();

          const status =
            res.statusCode && res.statusCode >= 200 && res.statusCode < 400
              ? "Up"
              : "Down";
          const connection_time_ms = diffMs(t_socket, t_connect);
          const tls_handshake_time_ms =
            urlObj.protocol === "https:" ? diffMs(t_connect, t_secure) : 0;
          const data_transfer_time_ms = diffMs(t_response, t_end);
          const total_response_time_ms = diffMs(t_start, t_end);
          try {
            await prisma.website_tick.create({
              data: {
                connection_time_ms,
                tls_handshake_time_ms,
                data_transfer_time_ms,
                total_response_time_ms,
                status,                 
                region_id: REGION_ID,   
                website_id: websiteId,  
              },
            });

            try {
              void publishSocketEvent('tick_update', {
                websiteId,
                status,
                response_ms: total_response_time_ms,
                region: REGION_ID,
                timestamp: new Date().toISOString()
              });
            } catch(e) {
              // ignore
            }
            console.log(`[${new Date().toISOString()}] [${REGION_ID}] ${url} → ${status} (${total_response_time_ms}ms)`);
            const consecutiveDownCount = recordCheck(websiteId, status);

            const website = await prisma.website.findUnique({
              where: { id: websiteId }
            });

            const now_date = new Date();
            const inMaintenance = website?.maintenance_start && 
              website?.maintenance_end &&
              now_date >= new Date(website.maintenance_start) && 
              now_date <= new Date(website.maintenance_end);

            if (inMaintenance) {
              console.log(`[MAINTENANCE] ${url} - skipping alerts`);
            } else {
              if (status === 'Down' && consecutiveDownCount >= 2) {
                // Only notify after 2+ consecutive down checks (2+ minutes)
                console.log(`[ALERT] ${url} has been DOWN for ${consecutiveDownCount} consecutive checks - sending email`);
                await NotificationService.checkAndNotifyStatusChange(
                  websiteId,
                  status,
                  REGION_ID
                );
              } else if (status === 'Up') {
                // Always notify when site comes back UP
                await NotificationService.checkAndNotifyStatusChange(
                  websiteId,
                  status,
                  REGION_ID
                );
              } else if (status === 'Down' && consecutiveDownCount === 1) {
                console.log(`[WARNING] ${url} is DOWN (check ${consecutiveDownCount}/2 - waiting to confirm before alerting)`);
              }
            }

            if (status === 'Up' && total_response_time_ms && 
                total_response_time_ms > 3000) {
              console.log(`[SLOW] ${url} responding slowly: ${total_response_time_ms}ms`);
              
              const website = await prisma.website.findUnique({
                where: { id: websiteId },
                include: { user: true }
              });
              
              if (website?.user?.email) {
                const slowCacheKey = `slow_${websiteId}`;
                const cached = notificationCache.get(slowCacheKey);
                const now = Date.now();
                
                if (!cached || now - cached > 6 * 60 * 60 * 1000) {
                  notificationCache.set(slowCacheKey, now);
                  
                  await resend.emails.send({
                    from: 'UpGuard <onboarding@resend.dev>',
                    to: website.user.email,
                    subject: `⚠️ Slow Response Alert - ${url}`,
                    html: `
                      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#fff;padding:30px;border-radius:12px">
                        <h1 style="color:#f59e0b">⚠️ Slow Response Detected</h1>
                        <p style="color:#94a3b8">Your website is responding slowly</p>
                        <div style="background:#0f172a;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #f59e0b">
                          <p><strong>Website:</strong> ${url}</p>
                          <p><strong>Response Time:</strong> <span style="color:#f59e0b;font-size:24px;font-weight:bold">${total_response_time_ms}ms</span></p>
                          <p><strong>Threshold:</strong> 3000ms</p>
                          <p><strong>Time:</strong> ${new Date().toUTCString()}</p>
                        </div>
                        <p style="color:#94a3b8">This could indicate server overload or network issues.</p>
                        <p style="color:#64748b;font-size:12px">UpGuard Monitoring • Alert sent once per 6 hours</p>
                      </div>
                    `
                  });
                }
              }
            }
          } catch (e) {
            console.error("DB/Notify error:", e);
          }

          resolve();
        });
      }
    );

    req.on("socket", (socket) => {
      t_socket = now();

      socket.on("lookup", () => {
        t_lookup = now();
      });
      socket.on("connect", () => {
        t_connect = now();
      });
      socket.on("secureConnect", () => {
        t_secure = now();
      });
    });req.on("response", () => {
      t_response = now();
    });

    req.on("error", async (err) => {
      const t_errEnd = now();
      const total_response_time_ms = diffMs(t_start, t_errEnd);

      try {
        await prisma.website_tick.create({
          data: {
            connection_time_ms: 0,
            tls_handshake_time_ms: 0,
            data_transfer_time_ms: 0,
            total_response_time_ms,
            status: "Down",
            region_id: REGION_ID,
            website_id: websiteId,
          },
        });

        try {
          void publishSocketEvent('tick_update', {
            websiteId,
            status: "Down",
            response_ms: total_response_time_ms,
            region: REGION_ID,
            timestamp: new Date().toISOString()
          });
        } catch(e) {
          // ignore
        }
        console.log(`[${new Date().toISOString()}] ${url} → DOWN (error: ${err.message})`);
        const consecutiveDownCount = recordCheck(websiteId, "Down");

        if (consecutiveDownCount >= 2) {
          console.log(`[ALERT] ${url} has been DOWN for ${consecutiveDownCount} consecutive checks - sending email`);
          await NotificationService.checkAndNotifyStatusChange(
            websiteId,
            "Down",
            REGION_ID
          );
        } else {
          console.log(`[WARNING] ${url} is DOWN (check ${consecutiveDownCount}/2 - waiting to confirm before alerting)`);
        }
      } catch (e) {
        console.error("DB/Notify error (on failure path):", e);
      }

      resolve();
    });

    req.end();
  });
}

main().catch((e) => {
  console.error("Worker crashed:", e);
  process.exit(1);
});
