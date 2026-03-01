import dotenv from 'dotenv';
dotenv.config();

export const JWTSECRET = process.env.JWT || 'alsfdadflasdflkasdjfaklsd';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
export const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';