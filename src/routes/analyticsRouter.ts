import express from 'express';
import { authMiddleware } from '../middlewares/authmiddleware';
import {
  getAnalytics,
  enableAnalytics,
  getErrors,
  resolveError,
} from '../controllers/analyticsController';

export const analyticsRouter = express.Router();

analyticsRouter.use(authMiddleware);

analyticsRouter.get('/:websiteId', getAnalytics);
analyticsRouter.post('/:websiteId/enable', enableAnalytics);
analyticsRouter.get('/:websiteId/errors', getErrors);
analyticsRouter.patch('/:websiteId/errors/:errorId/resolve', resolveError);

export default analyticsRouter;
