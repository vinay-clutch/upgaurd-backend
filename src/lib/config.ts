import dotenv from 'dotenv';
dotenv.config();

export const JWTSECRET = process.env.JWT || 'alsfdadflasdflkasdjfaklsd';

// Google OAuth (optional – safe for Railway)
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export const SESSION_SECRET =
  process.env.SESSION_SECRET || 'your-session-secret';

// Strict CLIENT_URL logic
const rawClientUrl = process.env.CLIENT_URL || '';
if (!rawClientUrl && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: CLIENT_URL environment variable is missing in production!');
}

export const CLIENT_URL = rawClientUrl.replace(/\/$/, '');
