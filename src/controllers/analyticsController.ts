import { Request, Response } from 'express';
import prisma from '../lib/db';

// Called when user enables analytics for a website
export const enableAnalytics = async (req: Request, res: Response) => {
  try {
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId!, user_id: req.userId! }

    });
    if (!website) { res.status(404).json({ message: "Not found" }); return; }

    const existing = await prisma.analytics_site.findUnique({
      where: { website_id: req.params.websiteId! }

    });
    if (existing) {
      res.json({ site_id: existing.id, already_enabled: true });
      return;
    }

    const site = await prisma.analytics_site.create({
      data: { website_id: req.params.websiteId! }

    });
    res.json({ site_id: site.id, message: "Analytics enabled!" });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

// PUBLIC endpoint - receives tracking data from visitor browsers
export const trackPageView = async (req: Request, res: Response) => {
  try {
    const { site_id, page_url, referrer, session_id } = req.body;
    
    const userAgent = req.headers['user-agent'] || '';
    const device = userAgent.includes('Mobile') ? 'Mobile' 
                 : userAgent.includes('Tablet') ? 'Tablet' 
                 : 'Desktop';
    const browser = userAgent.includes('Chrome') ? 'Chrome'
                  : userAgent.includes('Firefox') ? 'Firefox'
                  : userAgent.includes('Safari') ? 'Safari'
                  : userAgent.includes('Edge') ? 'Edge'
                  : 'Other';

    await prisma.page_view.create({
      data: {
        site_id,
        page_url: page_url || '/',
        referrer: referrer || null,
        device,
        browser,
        session_id
      }
    });

    // Update or create session
    if (session_id) {
      const existing = await prisma.analytics_session.findFirst({
        where: { site_id, session_id }
      });
      if (existing) {
        await prisma.analytics_session.update({
          where: { id: existing.id },
          data: { page_count: { increment: 1 } }
        });
      } else {
        await prisma.analytics_session.create({
          data: { site_id, session_id }
        });
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
};

// PUBLIC endpoint - receives JS errors
export const trackError = async (req: Request, res: Response) => {
  try {
    const { site_id, message, stack, page_url } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const browser = userAgent.includes('Chrome') ? 'Chrome'
                  : userAgent.includes('Firefox') ? 'Firefox'
                  : userAgent.includes('Safari') ? 'Safari'
                  : 'Other';

    await prisma.js_error.create({
      data: { site_id, message, stack, page_url, browser }
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
};

// PUBLIC endpoint - session end (how long they stayed)
export const trackSessionEnd = async (req: Request, res: Response) => {
  try {
    const { site_id, session_id, duration_seconds } = req.body;
    const session = await prisma.analytics_session.findFirst({
      where: { site_id, session_id }
    });
    if (session) {
      await prisma.analytics_session.update({
        where: { id: session.id },
        data: { 
          ended_at: new Date(),
          duration_seconds 
        }
      });
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
};

// Get analytics dashboard data (requires auth)
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const website = await prisma.website.findFirst({
      where: { id: req.params.websiteId, user_id: req.userId! }
    });
    if (!website) { res.status(404).json({ message: "Not found" }); return; }

    const site = await prisma.analytics_site.findUnique({
      where: { website_id: req.params.websiteId }
    });
    if (!site) { 
      res.json({ enabled: false }); 
      return; 
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalViews, recentViews, sessions, errors] = await Promise.all([
      prisma.page_view.count({ where: { site_id: site.id } }),
      prisma.page_view.findMany({
        where: { site_id: site.id, timestamp: { gte: since } },
        orderBy: { timestamp: 'desc' }
      }),
      prisma.analytics_session.findMany({
        where: { site_id: site.id, started_at: { gte: since } }
      }),
      prisma.js_error.findMany({
        where: { site_id: site.id, resolved: false },
        orderBy: { timestamp: 'desc' },
        take: 10
      })
    ]);

    // Top pages
    const pageCounts: Record<string, number> = {};
    recentViews.forEach((v: any) => {
      pageCounts[v.page_url] = (pageCounts[v.page_url] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 5)
      .map(([url, count]: [string, number]) => ({ url, count }));

    // Traffic sources
    const referrerCounts: Record<string, number> = {};
    recentViews.forEach((v: any) => {
      const ref = v.referrer || 'Direct';
      try {
        const hostname = ref !== 'Direct' 
          ? new URL(ref).hostname 
          : 'Direct';
        referrerCounts[hostname] = (referrerCounts[hostname] || 0) + 1;
      } catch {
        referrerCounts['Direct'] = (referrerCounts['Direct'] || 0) + 1;
      }
    });
    const topReferrers = Object.entries(referrerCounts)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]: [string, number]) => ({ source, count }));

    // Device breakdown
    const deviceCounts: Record<string, number> = {};
    recentViews.forEach((v: any) => {
      const d = v.device || 'Unknown';
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
    });

    // Browser breakdown
    const browserCounts: Record<string, number> = {};
    recentViews.forEach((v: any) => {
      const b = v.browser || 'Unknown';
      browserCounts[b] = (browserCounts[b] || 0) + 1;
    });

    // Avg session duration
    const completedSessions = sessions.filter((s: any) => s.duration_seconds);
    const avgDuration = completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum: number, s: any) => 
            sum + (s.duration_seconds || 0), 0
          ) / completedSessions.length
        )
      : 0;

    // Views per day for last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const count = recentViews.filter((v: any) => 
        new Date(v.timestamp).toDateString() === dateStr
      ).length;

      return { 
        date: dateStr, 
        count,
        label: date.toLocaleDateString('en', { weekday: 'short' })
      };
    }).reverse();

    res.json({
      enabled: true,
      site_id: site.id,
      total_views: totalViews,
      views_last_30_days: recentViews.length,
      unique_sessions: sessions.length,
      avg_session_duration_seconds: avgDuration,
      views_per_day: last7Days,
      top_pages: topPages,
      top_referrers: topReferrers,
      device_breakdown: deviceCounts,
      browser_breakdown: browserCounts,
      recent_errors: errors,
      total_errors: errors.length
    });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

// Resolve a JS error
export const resolveError = async (req: Request, res: Response) => {
  try {
    await prisma.js_error.update({
      where: { id: req.params.errorId },
      data: { resolved: true }
    });
    res.json({ message: "Error marked as resolved" });
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};

// Get all errors for a website
export const getErrors = async (req: Request, res: Response) => {
  try {
    const websiteId = req.params.websiteId;
    const site = await prisma.analytics_site.findUnique({
      where: { website_id: websiteId }
    });

    if (!site) {
      return res.status(404).json({ message: "Analytics not enabled for this site" });
    }

    const errors = await prisma.js_error.findMany({
      where: { site_id: site.id },
      orderBy: { timestamp: 'desc' }
    });

    res.json(errors);
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};
