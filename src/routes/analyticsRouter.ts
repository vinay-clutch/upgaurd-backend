import express from 'express';
import { authMiddleware } from '../middlewares/authmiddleware';
import {
  getAnalytics,
  enableAnalytics,
  getErrors,
  resolveError,
  getLiveCount,
  trackPageView,
  trackError,
  trackSessionEnd,
} from '../controllers/analyticsController';


export const analyticsRouter = express.Router();

// PUBLIC routes (no auth - called from visitor browsers)
analyticsRouter.post('/track/pageview', trackPageView);
analyticsRouter.post('/track/error', trackError);
analyticsRouter.post('/track/session-end', trackSessionEnd);

// Protected routes (need auth)
analyticsRouter.use(authMiddleware);
analyticsRouter.get('/:websiteId', getAnalytics);
analyticsRouter.get('/:websiteId/live-count', getLiveCount);
analyticsRouter.post('/:websiteId/enable', enableAnalytics);
analyticsRouter.get('/:websiteId/errors', getErrors);
analyticsRouter.patch('/errors/:errorId/resolve', resolveError);


export default analyticsRouter;
