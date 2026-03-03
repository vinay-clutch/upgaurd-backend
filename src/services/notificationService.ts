import { Resend } from "resend";
import prisma from "../lib/db";
// import { website_status } from "@prisma/client";
type website_status = "Up" | "Down" | "Unknown";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.Mail_API);

// ─── Error Diagnosis ──────────────────────────────────────────────────────
export interface DiagnosisResult {
  errorType: string;
  likelyCause: string;
  suggestedFixes: string[];
  severity: "critical" | "high" | "medium" | "low";
}

export function diagnoseError(
  statusCode?: number,
  errorMessage?: string,
  totalResponseMs?: number
): DiagnosisResult {
  if (!statusCode && errorMessage) {
    if (errorMessage.includes("ECONNREFUSED")) {
      return {
        errorType: "Connection Refused",
        likelyCause: "The server is not running or the port is blocked.",
        suggestedFixes: [
          "Check if your web server (nginx/apache/node) is running.",
          "Verify the port is open in your firewall rules.",
          "Check if the server process crashed — review server logs.",
        ],
        severity: "critical",
      };
    }
    if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("DNS")) {
      return {
        errorType: "DNS Resolution Failed",
        likelyCause: "Domain name could not be resolved to an IP address.",
        suggestedFixes: [
          "Check if your domain DNS records are correctly configured.",
          "Verify your domain has not expired.",
          "Try pinging the domain manually: ping yourdomain.com",
        ],
        severity: "critical",
      };
    }
    if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
      return {
        errorType: "Connection Timeout",
        likelyCause: "Server took too long to respond.",
        suggestedFixes: [
          "Check server CPU and memory usage — it may be overloaded.",
          "Verify your server's network bandwidth and latency.",
          "Check if a firewall is silently dropping packets.",
        ],
        severity: "high",
      };
    }
    if (errorMessage.includes("ECONNRESET")) {
      return {
        errorType: "Connection Reset",
        likelyCause: "Server forcibly closed the connection.",
        suggestedFixes: [
          "Check if your server ran out of file descriptors (ulimit).",
          "Verify keep-alive settings on your web server.",
          "Look for crashes in your application logs.",
        ],
        severity: "high",
      };
    }
    if (
      errorMessage.includes("certificate") ||
      errorMessage.includes("SSL") ||
      errorMessage.includes("TLS")
    ) {
      return {
        errorType: "SSL/TLS Certificate Error",
        likelyCause: "HTTPS certificate is invalid, expired, or self-signed.",
        suggestedFixes: [
          "Check your SSL certificate expiry date.",
          "Renew the certificate using Let's Encrypt: certbot renew",
          "Ensure the certificate matches your domain name.",
        ],
        severity: "high",
      };
    }
  }

  if (statusCode) {
    if (statusCode === 401) {
      return {
        errorType: "401 Unauthorized",
        likelyCause: "The page requires authentication.",
        suggestedFixes: [
          "If this page should be public, remove authentication requirements.",
          "Use a public health-check endpoint instead (e.g., /health).",
        ],
        severity: "medium",
      };
    }
    if (statusCode === 403) {
      return {
        errorType: "403 Forbidden",
        likelyCause: "Server is denying access — possibly blocking the monitor's IP.",
        suggestedFixes: [
          "Check if the monitoring agent's IP is blocked by your firewall.",
          "Verify file/directory permissions on your web server.",
        ],
        severity: "medium",
      };
    }
    if (statusCode === 404) {
      return {
        errorType: "404 Not Found",
        likelyCause: "The URL you are monitoring no longer exists.",
        suggestedFixes: [
          "Update the monitored URL to the correct path.",
          "Verify your deployment completed successfully.",
        ],
        severity: "medium",
      };
    }
    if (statusCode === 429) {
      return {
        errorType: "429 Too Many Requests",
        likelyCause: "Your server is rate-limiting the monitoring requests.",
        suggestedFixes: [
          "Add the monitoring agent's IP to your rate-limit whitelist.",
          "Use a dedicated /health endpoint that bypasses rate limiting.",
        ],
        severity: "low",
      };
    }
    if (statusCode === 500) {
      return {
        errorType: "500 Internal Server Error",
        likelyCause: "Your application threw an unhandled exception.",
        suggestedFixes: [
          "Check your application error logs immediately.",
          "Look for recent code deployments that may have introduced bugs.",
          "Verify database connectivity from your application.",
        ],
        severity: "critical",
      };
    }
    if (statusCode === 502) {
      return {
        errorType: "502 Bad Gateway",
        likelyCause: "Your reverse proxy (nginx) can't reach the backend app.",
        suggestedFixes: [
          "Check if your Node.js app process is running.",
          "Verify the upstream port in your nginx config matches your app port.",
          "Restart your application: pm2 restart all",
        ],
        severity: "critical",
      };
    }
    if (statusCode === 503) {
      return {
        errorType: "503 Service Unavailable",
        likelyCause: "Server is overloaded or in maintenance mode.",
        suggestedFixes: [
          "Check server CPU, memory, and disk usage.",
          "Scale up server resources or add load balancing.",
        ],
        severity: "high",
      };
    }
    if (statusCode === 504) {
      return {
        errorType: "504 Gateway Timeout",
        likelyCause: "The backend took too long to respond to the proxy.",
        suggestedFixes: [
          "Increase proxy_read_timeout in your nginx config.",
          "Optimize slow database queries in your application.",
        ],
        severity: "high",
      };
    }
  }

  if (totalResponseMs && totalResponseMs > 5000) {
    return {
      errorType: "Slow Response",
      likelyCause: "Website is responding but very slowly (> 5 seconds).",
      suggestedFixes: [
        "Check server CPU and memory usage.",
        "Consider adding a CDN or caching layer.",
      ],
      severity: "medium",
    };
  }

  return {
    errorType: "Unknown Error",
    likelyCause: "An unexpected error occurred while checking the website.",
    suggestedFixes: [
      "Check your server logs for more details.",
      "Try accessing the website manually from a browser.",
    ],
    severity: "high",
  };
}

// ─── Notification Cache ───────────────────────────────────────────────────
interface NotificationLog {
  websiteId: string;
  lastNotifiedStatus: website_status;
  lastNotifiedAt: Date;
}
const notificationCache = new Map<string, NotificationLog>();

// ─── Notification Service ─────────────────────────────────────────────────
export class NotificationService {
  static async checkAndNotifyStatusChange(
    websiteId: string,
    newStatus: website_status,
    regionId: string,
    statusCode?: number,
    errorMessage?: string,
    totalResponseMs?: number
  ) {
    try {
      const previousTick = await prisma.website_tick.findFirst({
        where: { website_id: websiteId, region_id: regionId },
        orderBy: { createdAt: "desc" },
        skip: 1,
      });

      const previousStatus = previousTick?.status;

      if (previousStatus && previousStatus !== newStatus) {
        await this.sendStatusChangeNotification(
          websiteId,
          newStatus,
          previousStatus,
          statusCode,
          errorMessage,
          totalResponseMs
        );
      }
    } catch (error) {
      console.error("Error checking status change:", error);
    }
  }

  private static async sendStatusChangeNotification(
    websiteId: string,
    newStatus: website_status,
    previousStatus: website_status,
    statusCode?: number,
    errorMessage?: string,
    totalResponseMs?: number
  ) {
    const cacheKey = `${websiteId}-${newStatus}`;
    const cached = notificationCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.lastNotifiedAt.getTime() < 5 * 60 * 1000 // 5 minutes cache
    ) {
      console.log(`[ALERT CLIPPING] Skipping repeated notification for ${websiteId} status ${newStatus}`);
      return;
    }

    console.log(`[ALERTING] Sending ${newStatus} notification for ${websiteId}`);

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { user: true },
    });

    if (!website?.user.email) return;

    // Maintenance check
    const now = new Date();
    const inMaintenance = website.maintenance_start && 
      website.maintenance_end &&
      now >= new Date(website.maintenance_start) && 
      now <= new Date(website.maintenance_end);

    if (inMaintenance) {
      return;
    }


    const diagnosis =
      newStatus === "Down"
        ? diagnoseError(statusCode, errorMessage, totalResponseMs)
        : null;

    await this.sendEmail(
      website.user.email,
      website.url,
      newStatus,
      previousStatus,
      diagnosis
    );

    // Send Discord alert if webhook is configured
    const userWithDiscord = await prisma.user.findUnique({
        where: { id: website.user_id }
    });

    if (userWithDiscord?.discord_webhook) {
        const { sendDiscordAlert } = await import('./discordService');
        await sendDiscordAlert(
            userWithDiscord.discord_webhook,
            website.url,
            newStatus,
            undefined,
            diagnosis?.errorType
        );
    }

    // Send Slack alert if webhook is configured
    if (userWithDiscord?.slack_webhook) {
        const { sendSlackAlert } = await import('./slackService');
        await sendSlackAlert(
            userWithDiscord.slack_webhook,
            website.url,
            newStatus,
            undefined,
            diagnosis?.errorType
        );
    }


    notificationCache.set(cacheKey, {
      websiteId,
      lastNotifiedStatus: newStatus,
      lastNotifiedAt: new Date(),
    });

    // notification sent
  }

  private static async sendEmail(
    email: string,
    websiteUrl: string,
    newStatus: website_status,
    previousStatus: website_status,
    diagnosis: DiagnosisResult | null
  ) {
    const isDown = newStatus === "Down";
    const subject = isDown
      ? `🚨 ALERT: ${websiteUrl} is DOWN`
      : `✅ RECOVERED: ${websiteUrl} is back UP`;

    const severityColor: Record<string, string> = {
      critical: "#dc2626",
      high: "#ea580c",
      medium: "#d97706",
      low: "#65a30d",
    };

    const diagnosisHtml =
      diagnosis
        ? `
      <div style="background:#fef2f2;border-left:4px solid ${severityColor[diagnosis.severity]};padding:16px;margin:20px 0;border-radius:4px;">
        <h3 style="margin:0 0 8px;color:${severityColor[diagnosis.severity]};">🔍 Error Diagnosis</h3>
        <p style="margin:4px 0;"><strong>Error Type:</strong> ${diagnosis.errorType}</p>
        <p style="margin:4px 0;"><strong>Likely Cause:</strong> ${diagnosis.likelyCause}</p>
        <p style="margin:8px 0 4px;"><strong>Suggested Fixes:</strong></p>
        <ul style="margin:0;padding-left:20px;">
          ${diagnosis.suggestedFixes.map((fix) => `<li style="margin:4px 0;">${fix}</li>`).join("")}
        </ul>
      </div>`
        : "";

    const html = isDown
      ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;">🚨 Website Down Alert</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;">
          <p><strong>Website:</strong> ${websiteUrl}</p>
          <p><strong>Status:</strong> <span style="color:#dc2626;">DOWN</span></p>
          <p><strong>Previous Status:</strong> ${previousStatus}</p>
          <p><strong>Detected At:</strong> ${new Date().toUTCString()}</p>
          ${diagnosisHtml}
          <p style="color:#6b7280;font-size:14px;">— UpGuard Monitoring Team</p>
        </div>
      </div>`
      : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#16a34a;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;">✅ Website Recovered</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;">
          <p><strong>Website:</strong> ${websiteUrl}</p>
          <p><strong>Status:</strong> <span style="color:#16a34a;">UP</span></p>
          <p><strong>Previous Status:</strong> ${previousStatus}</p>
          <p><strong>Recovered At:</strong> ${new Date().toUTCString()}</p>
          <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;margin:20px 0;">
            <p style="margin:0;">🎉 Your website is back online!</p>
          </div>
          <p style="color:#6b7280;font-size:14px;">— UpGuard Monitoring Team</p>
        </div>
      </div>`;

    const { error } = await resend.emails.send({
      from: "UpGuard <onboarding@resend.dev>",
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("Failed to send email:", error);
    }
  }

  // ─── Weekly / Monthly Report ────────────────────────────────────────────
  static async sendUptimeReport(
    websiteId: string,
    period: "weekly" | "monthly"
  ) {
    const days = period === "weekly" ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { user: true },
    });

    if (!website?.user.email) return;

    const ticks = await prisma.website_tick.findMany({
      where: { website_id: websiteId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    });

    const total = ticks.length;
    const upCount = ticks.filter((t: any) => t.status === "Up").length;
    const downCount = total - upCount;
    const uptimePct =
      total > 0 ? ((upCount / total) * 100).toFixed(2) : "N/A";
    const avgResponse =
      total > 0
        ? Math.round(
            ticks.reduce((sum: number, t: any) => sum + (t.total_response_time_ms || 0), 0) /
              total
          )
        : 0;


    // Find incidents
    const incidents: { start: Date; end?: Date; duration: string }[] = [];
    let incidentStart: Date | null = null;
    for (const tick of ticks) {
      if (tick.status === "Down" && !incidentStart) {
        incidentStart = tick.createdAt;
      } else if (tick.status === "Up" && incidentStart) {
        const dur = tick.createdAt.getTime() - incidentStart.getTime();
        incidents.push({
          start: incidentStart,
          end: tick.createdAt,
          duration: formatDuration(dur),
        });
        incidentStart = null;
      }
    }

    const incidentsHtml =
      incidents.length > 0
        ? incidents
            .slice(-10)
            .map(
              (inc) => `
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;">${inc.start.toUTCString()}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${inc.end?.toUTCString() || "Ongoing"}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${inc.duration}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="3" style="padding:8px;text-align:center;color:#16a34a;">✅ No incidents!</td></tr>`;

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;">
      <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;">📊 ${period === "weekly" ? "Weekly" : "Monthly"} Report</h1>
        <p style="color:#bfdbfe;margin:8px 0 0;">${website.url}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;">
        <div style="display:flex;gap:16px;margin-bottom:24px;">
          <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:32px;font-weight:bold;color:#16a34a;">${uptimePct}%</div>
            <div style="color:#6b7280;">Uptime</div>
          </div>
          <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:32px;font-weight:bold;color:#dc2626;">${incidents.length}</div>
            <div style="color:#6b7280;">Incidents</div>
          </div>
          <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:32px;font-weight:bold;color:#1e40af;">${avgResponse}ms</div>
            <div style="color:#6b7280;">Avg Response</div>
          </div>
        </div>
        <h3>Incident Log</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Started</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Resolved</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Duration</th>
            </tr>
          </thead>
          <tbody>${incidentsHtml}</tbody>
        </table>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">
          Period: ${since.toDateString()} – ${new Date().toDateString()}<br>
          Total checks: ${total} | Up: ${upCount} | Down: ${downCount}<br>
          <strong>UpGuard Monitoring</strong>
        </p>
      </div>
    </div>`;

    await resend.emails.send({
      from: "UpGuard <onboarding@resend.dev>",
      to: [website.user.email],
      subject: `📊 ${period === "weekly" ? "Weekly" : "Monthly"} Report — ${website.url}`,
      html,
    });

    // report sent

  }

  static cleanCache() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, value] of notificationCache.entries()) {
      if (value.lastNotifiedAt.getTime() < oneHourAgo) {
        notificationCache.delete(key);
      }
    }
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
