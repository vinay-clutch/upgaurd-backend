import { Router } from 'express';
import { authMiddleware } from '../middlewares/authmiddleware';
import {
  enableAnalytics,
  trackPageView,
  trackError,
  trackSessionEnd,
  getAnalytics,
  resolveError
} from '../controllers/analyticsController';

export const analyticsRouter = Router();

// PUBLIC routes (no auth - called from visitor browsers)
analyticsRouter.post('/track/pageview', trackPageView);
analyticsRouter.post('/track/error', trackError);
analyticsRouter.post('/track/session-end', trackSessionEnd);

// Protected routes (need auth)
analyticsRouter.use(authMiddleware);
analyticsRouter.post('/:websiteId/enable', enableAnalytics);
analyticsRouter.get('/:websiteId', getAnalytics);
analyticsRouter.patch('/errors/:errorId/resolve', resolveError);
