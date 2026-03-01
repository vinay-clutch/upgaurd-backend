import { Router } from 'express';
import { CreateWebsite, websiteStatus, getUserWebsites, updateUserEmail, deleteWebsite, sendReport, getDashboardStats, pauseWebsite, resumeWebsite, getIncidentHistory, getSslStatus, getPublicStatus, updateDiscordWebhook, removeDiscordWebhook, downloadPdfReport, updateSlackWebhook, removeSlackWebhook, updateWebsiteTags, getUptimeBadge, getSecurityHeaders, updateCheckInterval, setMaintenance, clearMaintenance, exportCsv } from '../controllers/websiteController';

import { authMiddleware } from '../middlewares/authmiddleware';

export const websiteRouter = Router();

// Public route - no auth required
websiteRouter.get('/public/:websiteId', getPublicStatus);
websiteRouter.get('/badge/:websiteId', getUptimeBadge);

websiteRouter.use(authMiddleware);
websiteRouter.post('/', CreateWebsite);
websiteRouter.get('/', getUserWebsites);
websiteRouter.delete('/:websiteId', deleteWebsite);
websiteRouter.get('/dashboard', getDashboardStats);
websiteRouter.get('/:websiteId/status', websiteStatus);
websiteRouter.post('/:websiteId/report', sendReport);
websiteRouter.put('/user/email', updateUserEmail);
websiteRouter.post('/:websiteId/pause', pauseWebsite);
websiteRouter.post('/:websiteId/resume', resumeWebsite);
websiteRouter.get('/:websiteId/incidents', getIncidentHistory);
websiteRouter.get('/:websiteId/ssl', getSslStatus);
websiteRouter.put('/user/discord', updateDiscordWebhook);
websiteRouter.delete('/user/discord', removeDiscordWebhook);
websiteRouter.get('/:websiteId/report/pdf', downloadPdfReport);
websiteRouter.put('/user/slack', updateSlackWebhook);
websiteRouter.delete('/user/slack', removeSlackWebhook);
websiteRouter.put('/:websiteId/tags', updateWebsiteTags);
websiteRouter.get('/:websiteId/security', getSecurityHeaders);
websiteRouter.put('/:websiteId/interval', updateCheckInterval);
websiteRouter.put('/:websiteId/maintenance', setMaintenance);
websiteRouter.delete('/:websiteId/maintenance', clearMaintenance);
websiteRouter.get('/:websiteId/export/csv', exportCsv);
