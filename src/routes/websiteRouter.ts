import express from 'express';
import { authMiddleware } from '../middlewares/authmiddleware';
import {
  createWebsite,
  getWebsites,
  getWebsiteStatus,
  deleteWebsite,
  pauseWebsite,
  resumeWebsite,
  getIncidentHistory,
  getSslStatus,
  updateCheckInterval,
  setMaintenance,
  clearMaintenance,
  updateWebsiteTags,
  getSecurityHeaders,
  getUptimeBadge,
  downloadPdfReport,
  exportCsv,
  getPublicStatus,
  getDashboardStats,
  getGlobalPerformance,
  getSmartRemediation,
  getAIMLStats
} from '../controllers/websiteController';

export const websiteRouter = express.Router();

// PUBLIC routes - NO auth needed - MUST be before authMiddleware
websiteRouter.get('/badge/:id', getUptimeBadge);
websiteRouter.get('/public/:id', getPublicStatus);

// All routes below require auth
websiteRouter.use(authMiddleware);

websiteRouter.get('/stats/summary', getDashboardStats);
websiteRouter.get('/stats/performance', getGlobalPerformance);

websiteRouter.post('/', createWebsite);
websiteRouter.get('/', getWebsites);
websiteRouter.get('/:id/status', getWebsiteStatus);
websiteRouter.delete('/:id', deleteWebsite);
websiteRouter.post('/:id/pause', pauseWebsite);
websiteRouter.post('/:id/resume', resumeWebsite);
websiteRouter.get('/:id/incidents', getIncidentHistory);
websiteRouter.get('/:id/ssl', getSslStatus);
websiteRouter.put('/:id/interval', updateCheckInterval);
websiteRouter.put('/:id/maintenance', setMaintenance);
websiteRouter.delete('/:id/maintenance', clearMaintenance);
websiteRouter.put('/:id/tags', updateWebsiteTags);
websiteRouter.get('/:id/security', getSecurityHeaders);
websiteRouter.get('/:id/report/pdf', downloadPdfReport);
websiteRouter.get('/:id/export/csv', exportCsv);
websiteRouter.get('/remediation/suggest', getSmartRemediation);
websiteRouter.get('/aiml/stats', getAIMLStats);

export default websiteRouter;
