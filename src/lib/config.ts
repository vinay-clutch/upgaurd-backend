import 'dotenv/config';

export const JWTSECRET = process.env.JWT || 'fallback_jwt_secret';
export const JWT_SECRET = process.env.JWT || 'fallback_jwt_secret';
export const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback_session';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
export const DATABASE_URL = process.env.DATABASE_URL;
export const REDIS_URL = process.env.REDIS_URL;
export const REGION_ID = process.env.REGION_ID || 'us-east-1';
export const WORKER_ID = process.env.WORKER_ID || 'worker-1';
export const Mail_API = process.env.Mail_API;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
