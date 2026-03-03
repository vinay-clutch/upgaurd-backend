import { Request, Response } from 'express';
import prisma from '../lib/db';
import { NotificationService, diagnoseError } from '../services/notificationService';
import dotenv from 'dotenv';
import { Resend } from "resend";
dotenv.config();

// Initialize Resend with environment variable
const resend = process.env.Mail_API ? new Resend(process.env.Mail_API) : null;

export const CreateWebsite = async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        if (!url) {
            res.status(400).json({ message: "URL is required" });
            return;
        }

        // Validate URL format
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                res.status(400).json({ message: "Only HTTP/HTTPS URLs allowed" });
                return;
            }
        } catch {
            res.status(400).json({ message: "Invalid URL format" });
            return;
        }

        // Prevent monitoring localhost or private IPs
        const hostname = new URL(url).hostname;
        if (
            hostname === 'localhost' ||
            hostname.startsWith('192.168') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('127.')
        ) {
            res.status(400).json({ 
                message: "Cannot monitor local/private addresses" 
            });
            return;
        }

        const website = await prisma.website.create({
            data: { url, user_id: req.userId!, time_added: new Date() }
        });
        res.json({ id: website.id, url: website.url });
    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
};

export const deleteWebsite = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const website = await prisma.website.findFirst({
            where: { id: websiteId, user_id: req.userId! }
        });
        if (!website) { res.status(404).json({ message: "Website not found" }); return; }
        await prisma.website_tick.deleteMany({ where: { website_id: website.id } });
        await prisma.website.delete({ where: { id: website.id } });
        res.json({ message: "Website deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
};

export const websiteStatus = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const website = await prisma.website.findFirst({
            where: { user_id: req.userId!, id: websiteId }
        });
        if (!website) { res.status(404).json({ message: "website not found" }); return; }

        const recentTicks = await prisma.website_tick.findMany({
            where: { website_id: website.id },
            include: { region: true },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        let uptimePercentage = 0;
        let latestStatus = 'Unknown';
        let continuousUptimeStart = null;
        let uptimeDuration = null;

        if (recentTicks.length > 0) {
            latestStatus = recentTicks[0]?.status!;
            const upCount = recentTicks.filter((t: any) => t.status === 'Up').length;

            uptimePercentage = Math.round((upCount / recentTicks.length) * 10000) / 100;

            if (latestStatus === 'Up') {
                let uptimeStartIndex = 0;
                for (let i = 0; i < recentTicks.length; i++) {
                    if (recentTicks[i]?.status !== 'Up') { uptimeStartIndex = i; break; }
                    uptimeStartIndex = i + 1;
                }
                const firstTick = await prisma.website_tick.findFirst({
                    where: { website_id: website.id },
                    orderBy: { createdAt: 'asc' }
                });
                continuousUptimeStart = firstTick?.createdAt || null;

                if (continuousUptimeStart) {
                    const diffMs = Date.now() - new Date(continuousUptimeStart).getTime();
                    const days = Math.floor(diffMs / 86400000);
                    const hours = Math.floor((diffMs % 86400000) / 3600000);
                    const minutes = Math.floor((diffMs % 3600000) / 60000);
                    uptimeDuration = {
                        total_ms: diffMs, days, hours, minutes,
                        formatted: days > 0 ? `${days}d ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                    };
                }
            }
        }

        let currentDiagnosis = null;
        if (latestStatus === 'Down' && recentTicks.length > 0) {
            const lastTick = recentTicks[0];
            currentDiagnosis = diagnoseError(undefined, undefined, lastTick?.total_response_time_ms ?? undefined);
        }

        res.json({
            url: website.url,
            id: website.id,
            isPaused: website.isPaused,
            tags: website.tags,
            maintenance_start: website.maintenance_start,
            maintenance_end: website.maintenance_end,
            maintenance_note: website.maintenance_note,
            latest_status: latestStatus,
            uptime_percentage: uptimePercentage,
            continuous_uptime_start: continuousUptimeStart,
            uptime_duration: uptimeDuration,
            current_diagnosis: currentDiagnosis,
            recent_ticks: recentTicks.map((t: any) => ({

                status: t.status,
                connection_time_ms: t.connection_time_ms,
                tls_handshake_time_ms: t.tls_handshake_time_ms,
                data_transfer_time_ms: t.data_transfer_time_ms,
                total_response_time_ms: t.total_response_time_ms,
                region: t.region?.name || 'Unknown',
                timestamp: t.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
};

export const getUserWebsites = async (req: Request, res: Response) => {
    try {
        const websites = await prisma.website.findMany({
            where: { user_id: req.userId! },
            include: { 
                ticks: { 
                    orderBy: { createdAt: 'desc' }, 
                    take: 50 // Take last 50 for uptime calculation
                } 
            },
            orderBy: { time_added: 'desc' }
        });

        const websitesWithStatus = websites.map((w: any) => {
            const lastTicks = w.ticks;
            const upCount = lastTicks.filter((t: any) => t.status === 'Up').length;

            const uptime_percentage = lastTicks.length > 0 
                ? parseFloat(((upCount / lastTicks.length) * 100).toFixed(1)) 
                : 0;

            return {
                id: w.id, 
                url: w.url, 
                time_added: w.time_added,
                isPaused: w.isPaused,
                tags: w.tags,
                maintenance_start: w.maintenance_start,
                maintenance_end: w.maintenance_end,
                maintenance_note: w.maintenance_note,
                latest_status: lastTicks[0]?.status || 'Unknown',
                last_checked: lastTicks[0]?.createdAt || null,
                last_response_ms: lastTicks[0]?.total_response_time_ms || null,
                uptime_percentage
            };
        });

        res.json({ websites: websitesWithStatus, total: websites.length });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const pauseWebsite = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const website = await prisma.website.findFirst({
            where: { id: websiteId, user_id: req.userId! }
        });
        if (!website) { res.status(404).json({ message: "Website not found" }); return; }
        await prisma.website.update({
            where: { id: websiteId },
            data: { isPaused: true }
        });
        res.json({ message: "Monitoring paused" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const resumeWebsite = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const website = await prisma.website.findFirst({
            where: { id: websiteId, user_id: req.userId! }
        });
        if (!website) { res.status(404).json({ message: "Website not found" }); return; }
        await prisma.website.update({
            where: { id: websiteId },
            data: { isPaused: false }
        });
        res.json({ message: "Monitoring resumed" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateUserEmail = async (req: Request, res: Response) => {
    const { email } = req.body;
    try {
        if (!email) { 
            res.status(400).json({ message: "email is required" }); 
            return; 
        }
        
        if (!req.userId) {
            res.status(401).json({ message: "unauthorized" });
            return;
        }

        await prisma.user.update({ 
            where: { id: req.userId }, 
            data: { email: email } 
        });
        
        res.json({ message: "Email updated successfully" });
        
    } catch (error: any) {
        console.error("updateUserEmail error details:", {
            code: error.code,
            message: error.message,
            meta: error.meta
        });

        const isUniqueConstraint = 
            error.code === 'P2002' || 
            (error.message && error.message.includes('Unique constraint')) ||
            (error.message && error.message.includes('unique constraint'));

        if (isUniqueConstraint) {
            console.log(`[AUTH] Email update conflict: ${email} already in use`);
            res.status(400).json({ 
                message: "This email is already in use by another account" 
            });
            return;
        }

        res.status(500).json({ 
            message: "internal server error",
            error: error.message 
        });
    }
};

export const sendReport = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const period = (req.query.period as string) === 'monthly' ? 'monthly' : 'weekly';
        const website = await prisma.website.findFirst({
            where: { id: websiteId, user_id: req.userId! }
        });
        if (!website) { res.status(404).json({ message: "Website not found" }); return; }
        await NotificationService.sendUptimeReport(websiteId, period as "weekly" | "monthly");
        res.json({ message: `${period} report sent to your email!` });
    } catch (error) {
        res.status(500).json({ message: "Failed to send report" });
    }
};

export const getIncidentHistory = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const website = await prisma.website.findFirst({
            where: { id: websiteId, user_id: req.userId! }
        });
        if (!website) { res.status(404).json({ message: "Website not found" }); return; }

        const ticks = await prisma.website_tick.findMany({
            where: { website_id: websiteId },
            orderBy: { createdAt: 'asc' },
        });

        const incidents: any[] = [];
        let incidentStart: Date | null = null;
        let incidentRegion: string | null = null;

        for (const tick of ticks) {
            if (tick.status === 'Down' && !incidentStart) {
                incidentStart = tick.createdAt;
                incidentRegion = tick.region_id;
            } else if (tick.status === 'Up' && incidentStart) {
                const durationMs = tick.createdAt.getTime() - new Date(incidentStart).getTime();
                const minutes = Math.floor(durationMs / 60000);
                const hours = Math.floor(minutes / 60);
                incidents.push({
                    id: incidents.length + 1,
                    started_at: incidentStart,
                    resolved_at: tick.createdAt,
                    duration_minutes: minutes,
                    duration_formatted: hours > 0 
                      ? `${hours}h ${minutes % 60}m` 
                      : `${minutes}m`,
                    region: incidentRegion,
                    status: 'Resolved'
                });
                incidentStart = null;
            }
        }

        if (incidentStart) {
            const durationMs = Date.now() - new Date(incidentStart).getTime();
            const minutes = Math.floor(durationMs / 60000);
            const hours = Math.floor(minutes / 60);
            incidents.push({
                id: incidents.length + 1,
                started_at: incidentStart,
                resolved_at: null,
                duration_minutes: minutes,
                duration_formatted: hours > 0 
                  ? `${hours}h ${minutes % 60}m` 
                  : `${minutes}m`,
                region: incidentRegion,
                status: 'Ongoing'
            });
        }

        res.json({
            website_url: website.url,
            total_incidents: incidents.length,
            incidents: incidents.reverse()
        });
    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
};

export const getSslStatus = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const website = await prisma.website.findFirst({
            where: { id: websiteId, user_id: req.userId! }
        });
        if (!website) { 
          res.status(404).json({ message: "Website not found" }); 
          return; 
        }
        if (!website.url.startsWith('https://')) {
            res.json({ 
                valid: false, 
                daysUntilExpiry: 0,
                expiryDate: 'N/A',
                issuer: 'N/A',
                error: 'Site does not use HTTPS' 
            });
            return;
        }
        const { checkSSL } = await import('../services/sslChecker');
        const hostname = new URL(website.url).hostname;
        const sslInfo = await checkSSL(hostname);
        res.json(sslInfo);
    } catch (error) {
        res.status(500).json({ message: "Failed to check SSL" });
    }
};

export const getPublicStatus = async (req: Request, res: Response) => {
    try {
        const websiteId = req.params.websiteId as string;
        const website = await prisma.website.findFirst({
            where: { id: websiteId }
        });
        if (!website) { 
          res.status(404).json({ message: "Not found" }); 
          return; 
        }

        const ticks = await prisma.website_tick.findMany({
            where: { website_id: websiteId },
            orderBy: { createdAt: 'desc' },
            take: 90,
            include: { region: true }
        });

        const upCount = ticks.filter((t: any) => t.status === 'Up').length;
        const uptimePercentage = ticks.length > 0 
            ? Math.round((upCount / ticks.length) * 10000) / 100 
            : 0;
        const latestStatus = ticks[0]?.status || 'Unknown';
        const avgResponse = ticks.length > 0
            ? Math.round(
                ticks.reduce((s: number, t: any) => s + (t.total_response_time_ms || 0), 0) 
                / ticks.length
              )
            : 0;

        res.json({
            url: website.url,
            current_status: latestStatus,
            uptime_percentage: uptimePercentage,
            avg_response_ms: avgResponse,
            last_checked: ticks[0]?.createdAt || null,
            last_90_checks: ticks.map((t: any) => ({

                status: t.status,
                timestamp: t.createdAt,
                response_ms: t.total_response_time_ms,
                region: t.region?.name || 'Unknown'
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
};

export const updateDiscordWebhook = async (req: Request, res: Response) => {
    try {
        const { webhook_url } = req.body;
        if (!webhook_url) {
            res.status(400).json({ message: "webhook_url is required" });
            return;
        }
        
        const { sendDiscordTestMessage } = await import('../services/discordService');
        const testResult = await sendDiscordTestMessage(webhook_url);
        
        if (!testResult) {
            res.status(400).json({ 
              message: "Invalid webhook URL - could not connect to Discord" 
            });
            return;
        }
        
        await prisma.user.update({
            where: { id: req.userId! },
            data: { discord_webhook: webhook_url }
        });
        
        res.json({ message: "Discord webhook saved and tested successfully!" });
    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
};

export const removeDiscordWebhook = async (req: Request, res: Response) => {
    try {
        await prisma.user.update({
            where: { id: req.userId! },
            data: { discord_webhook: null }
        });
        res.json({ message: "Discord webhook removed" });
    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
};

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const websites = await prisma.website.findMany({
            where: { user_id: req.userId! },
            include: { ticks: { orderBy: { createdAt: 'desc' }, take: 10 } }
        });
        const total = websites.length;
        const up = websites.filter((w: any) => w.ticks?.[0]?.status === 'Up').length;
        const down = websites.filter((w: any) => w.ticks?.[0]?.status === 'Down').length;
        const unknown = websites.filter((w: any) => !w.ticks || w.ticks.length === 0 || w.ticks[0]?.status === 'Unknown').length;

        const avgUptime = websites.reduce((sum: number, w: any) => {
            const ticks = w.ticks || [];
            if (ticks.length === 0) return sum;
            return sum + (ticks.filter((t: any) => t.status === 'Up').length / ticks.length) * 100;
        }, 0) / (total || 1);

        res.json({
            total_websites: total,
            websites_up: up,
            websites_down: down,
            websites_unknown: unknown,
            avg_uptime_percentage: Math.round(avgUptime * 100) / 100,
            has_incidents: down > 0
        });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const downloadPdfReport = async (req: Request, res: Response) => {
  try {
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId, user_id: req.userId! }
    });
    if (!website) { 
      res.status(404).json({ message: "Not found" }); 
      return; 
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ticks = await prisma.website_tick.findMany({
      where: { 
        website_id: req.params.websiteId, 
        createdAt: { gte: since } 
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = ticks.length;
    const upCount = ticks.filter(t => t.status === 'Up').length;
    const uptimePct = total > 0 
      ? ((upCount / total) * 100).toFixed(2) 
      : '0';
    const avgResponse = total > 0
      ? Math.round(
          ticks.reduce((s, t) => s + (t.total_response_time_ms || 0), 0) / total
        )
      : 0;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>UpGuard Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
    h1 { color: #1e40af; }
    .stats { display: flex; gap: 20px; margin: 20px 0; }
    .stat { flex: 1; background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e5e7eb; }
    .stat-number { font-size: 32px; font-weight: bold; }
    .green { color: #16a34a; }
    .red { color: #dc2626; }
    .blue { color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1e40af; color: white; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    .badge-up { background: #dcfce7; color: #16a34a; padding: 2px 8px; border-radius: 4px; }
    .badge-down { background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 4px; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #1e40af; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Save as PDF</button>
  <h1>🛡️ UpGuard Report — ${website.url}</h1>
  <p>Period: Last 30 days | Generated: ${new Date().toUTCString()}</p>
  <div class="stats">
    <div class="stat">
      <div class="stat-number ${parseFloat(uptimePct) > 99 ? 'green' : 'red'}">${uptimePct}%</div>
      <div style="color:#6b7280">Uptime</div>
    </div>
    <div class="stat">
      <div class="stat-number blue">${avgResponse}ms</div>
      <div style="color:#6b7280">Avg Response</div>
    </div>
    <div class="stat">
      <div class="stat-number">${total}</div>
      <div style="color:#6b7280">Total Checks</div>
    </div>
    <div class="stat">
      <div class="stat-number red">${total - upCount}</div>
      <div style="color:#6b7280">Failed Checks</div>
    </div>
  </div>
  <h2>Recent Checks</h2>
  <table>
    <tr><th>Status</th><th>Response Time</th><th>Time</th></tr>
    ${ticks.slice(0, 50).map(t => `
    <tr>
      <td><span class="${t.status === 'Up' ? 'badge-up' : 'badge-down'}">${t.status}</span></td>
      <td>${t.total_response_time_ms || 0}ms</td>
      <td>${new Date(t.createdAt).toLocaleString()}</td>
    </tr>`).join('')}
  </table>
  <p style="margin-top:40px;color:#9ca3af;text-align:center">Generated by UpGuard • ${new Date().toDateString()}</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

export const updateSlackWebhook = async (req: Request, res: Response) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) {
      res.status(400).json({ message: "webhook_url required" });
      return;
    }
    const { sendSlackTestMessage } = await import('../services/slackService');
    const ok = await sendSlackTestMessage(webhook_url);
    if (!ok) {
      res.status(400).json({ message: "Invalid Slack webhook URL" });
      return;
    }
    await prisma.user.update({
      where: { id: req.userId! },
      data: { slack_webhook: webhook_url }
    });
    res.json({ message: "Slack connected successfully!" });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

export const removeSlackWebhook = async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId! },
      data: { slack_webhook: null }
    });
    res.json({ message: "Slack disconnected" });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

export const updateWebsiteTags = async (req: Request, res: Response) => {
  try {
    const { tags } = req.body;
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId, user_id: req.userId! }
    });
    if (!website) { 
      res.status(404).json({ message: "Not found" }); 
      return; 
    }
    await prisma.website.update({
      where: { id: req.params.websiteId },
      data: { tags }
    });
    res.json({ message: "Tags updated!" });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

export const getUptimeBadge = async (req: Request, res: Response) => {
  try {
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId }
    });
    if (!website) {
      res.status(404).send('Not found');
      return;
    }

    const ticks = await prisma.website_tick.findMany({
      where: { website_id: req.params.websiteId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const upCount = ticks.filter(t => t.status === 'Up').length;
    const uptimePct = ticks.length > 0
      ? ((upCount / ticks.length) * 100).toFixed(1)
      : '0.0';
    const latestStatus = ticks[0]?.status || 'Unknown';
    
    const color = latestStatus === 'Up' 
      ? '%2316a34a'  
      : latestStatus === 'Down' 
        ? '%23dc2626' 
        : '%236b7280';
    
    const statusText = latestStatus === 'Up' ? 'up' : 
                       latestStatus === 'Down' ? 'down' : 'unknown';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
      xmlns:xlink="http://www.w3.org/1999/xlink" 
      width="150" height="20">
      <linearGradient id="s" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
      </linearGradient>
      <clipPath id="r">
        <rect width="150" height="20" rx="3" fill="#fff"/>
      </clipPath>
      <g clip-path="url(#r)">
        <rect width="70" height="20" fill="#555"/>
        <rect x="70" width="80" height="20" fill="${color.replace('%23', '#')}"/>
        <rect width="150" height="20" fill="url(#s)"/>
      </g>
      <g fill="#fff" text-anchor="middle" 
         font-family="DejaVu Sans,Verdana,Geneva,sans-serif" 
         font-size="110">
        <text x="355" y="150" fill="#010101" fill-opacity=".3" 
              transform="scale(.1)" textLength="590" 
              lengthAdjust="spacing">uptime</text>
        <text x="355" y="140" transform="scale(.1)" 
              textLength="590" lengthAdjust="spacing">uptime</text>
        <text x="1090" y="150" fill="#010101" fill-opacity=".3" 
              transform="scale(.1)" textLength="690" 
              lengthAdjust="spacing">${uptimePct}% ${statusText}</text>
        <text x="1090" y="140" transform="scale(.1)" 
              textLength="690" 
              lengthAdjust="spacing">${uptimePct}% ${statusText}</text>
      </g>
    </svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, max-age=0');
    res.send(svg);
  } catch (error) {
    res.status(500).send('Error');
  }
};

export const getSecurityHeaders = async (req: Request, res: Response) => {
  try {
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId, user_id: req.userId! }
    });
    if (!website) { 
      res.status(404).json({ message: "Not found" }); 
      return; 
    }
    const { checkSecurityHeaders } = await import('../services/securityChecker');
    const report = await checkSecurityHeaders(website.url);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Failed to check security" });
  }
};

export const updateCheckInterval = async (req: Request, res: Response) => {
  try {
    const { interval } = req.body;
    if (![1, 5, 15, 30, 60].includes(interval)) {
      res.status(400).json({ message: "Invalid interval" });
      return;
    }
    await prisma.website.update({
      where: { id: req.params.websiteId, user_id: req.userId! },
      data: { check_interval: interval }
    });
    res.json({ message: "Interval updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update interval" });
  }
};

export const setMaintenance = async (req: Request, res: Response) => {
  try {
    const { start, end, note } = req.body;
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId, user_id: req.userId! }
    });
    if (!website) { 
      res.status(404).json({ message: "Not found" }); 
      return; 
    }
    await prisma.website.update({
      where: { id: req.params.websiteId },
      data: { 
        maintenance_start: start ? new Date(start) : null,
        maintenance_end: end ? new Date(end) : null,
        maintenance_note: note || null
      }
    });
    res.json({ message: "Maintenance window set!" });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

export const clearMaintenance = async (req: Request, res: Response) => {
  try {
    await prisma.website.update({
      where: { id: req.params.websiteId },
      data: { 
        maintenance_start: null,
        maintenance_end: null,
        maintenance_note: null
      }
    });
    res.json({ message: "Maintenance window cleared!" });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

export const exportCsv = async (req: Request, res: Response) => {
  try {
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId, user_id: req.userId! }
    });
    if (!website) { 
      res.status(404).json({ message: "Not found" }); 
      return; 
    }

    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ticks = await prisma.website_tick.findMany({
      where: { 
        website_id: req.params.websiteId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    });

    const csvRows = [
      ['Timestamp', 'Status', 'Response Time (ms)', 'Region'].join(','),
      ...ticks.map(t => [
        new Date(t.createdAt).toISOString(),
        t.status,
        t.total_response_time_ms || 0,
        t.region_id || 'us-east-1'
      ].join(','))
    ];

    const csv = csvRows.join('\n');
    const filename = `upguard-${website.url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-')}-${days}days.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: "Failed to export CSV" });
  }
};

export const websiteController = {
  async sendContactEmail(req: Request, res: Response) {
    try {
      if (!resend) {
        return res.status(500).json({
          success: false,
          message: "Email service not configured",
        });
      }

      const { email, subject, message } = req.body;

      if (!email || !subject || !message) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      const response = await resend.emails.send({
        from: "noreply@upgaurd.com",
        to: email,
        subject: subject,
        html: `<h2>${subject}</h2><p>${message}</p><hr><p>From: ${email}</p>`,
      });

      if (response.error) {
        return res.status(500).json({
          success: false,
          message: "Failed to send email",
          error: response.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Email sent successfully",
        data: response.data,
      });
    } catch (error) {
      console.error("Contact email error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async getWebsiteStatus(req: Request, res: Response) {
    try {
      return res.status(200).json({
        success: true,
        status: "Website is running",
        emailServiceActive: !!resend,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to get website status",
      });
    }
  },
};

