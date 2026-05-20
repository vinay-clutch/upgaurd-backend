import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getPublicStatus = async (req: Request, res: Response) => {
  const { username } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        websites: {
          select: {
            id: true,
            url: true,
            isPaused: true,
            ticks: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Status page not found' });
    }

    const formattedWebsites = user.websites.map(site => {
      const latestTick = site.ticks[0];
      return {
        id: site.id,
        url: site.url,
        status: site.isPaused ? 'Paused' : (latestTick?.status || 'Unknown'),
        latency: latestTick?.total_response_time_ms || 0,
        last_checked: latestTick?.createdAt || null
      };
    });

    res.json({
      username: user.username,
      websites: formattedWebsites,
      global_nodes: [
        { name: 'Mumbai, IN', status: 'Operational', latency: '42ms' },
        { name: 'Singapore, SG', status: 'Operational', latency: '68ms' },
        { name: 'US East, VA', status: 'Network Anomaly', latency: '124ms' }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
