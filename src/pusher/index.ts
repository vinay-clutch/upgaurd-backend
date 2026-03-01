import { xAddBulk } from "../redis";
import prisma from "../lib/db";
import dotenv from "dotenv";
dotenv.config();

const CHECK_INTERVAL_MS = 60_000;

async function pushWebsitesToQueue() {
  try {
    const websites = await prisma.website.findMany({ 
      where: { isPaused: false },
      select: { id: true, url: true, check_interval: true } 
    });

    const currentMinute = Math.floor(Date.now() / 60000);
    const toPush = websites.filter(w => (currentMinute % (w.check_interval || 1)) === 0);

    if (toPush.length === 0) { 
      return; 
    }
    await xAddBulk(toPush.map((w: { id: string; url: string }) => ({ url: w.url, id: w.id })));

    // pushed to queue
  } catch (err) {
    console.error("Pusher error:", err);
  }
}

async function main() {
  // Pusher started
  await pushWebsitesToQueue();
  setInterval(pushWebsitesToQueue, CHECK_INTERVAL_MS);
}

main().catch((e) => { console.error("Pusher crashed:", e); process.exit(1); });
