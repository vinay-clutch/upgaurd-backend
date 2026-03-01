import prisma from '../lib/db';
import { NotificationService } from '../services/notificationService';
import dotenv from 'dotenv';
dotenv.config();

async function sendWeeklyReports() {
    const websites = await prisma.website.findMany({ include: { user: true } });
    for (const website of websites) {
        if (website.user.email) await NotificationService.sendUptimeReport(website.id, 'weekly' as const);
    }
}

async function sendMonthlyReports() {
    const websites = await prisma.website.findMany({ include: { user: true } });
    for (const website of websites) {
        if (website.user.email) await NotificationService.sendUptimeReport(website.id, 'monthly' as const);
    }
}

export function scheduleReports() {
    const check = () => {
        const now = new Date();
        if (now.getUTCDay() === 0 && now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
            sendWeeklyReports().catch(console.error);
        }
        if (now.getUTCDate() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
            sendMonthlyReports().catch(console.error);
        }
    };
    setInterval(check, 60_000);
}

export { sendWeeklyReports, sendMonthlyReports };
