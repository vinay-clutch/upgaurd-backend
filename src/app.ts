import express, { Response, Request, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import cors from 'cors';
import passport from './config/passport';
import { authRouter } from './routes/authRouter';
import { websiteRouter } from './routes/websiteRouter';
import { SESSION_SECRET, CLIENT_URL } from './lib/config';
import { scheduleReports } from './services/reportScheduler';
import { analyticsRouter } from './routes/analyticsRouter';
import { getTrackerScript } from './controllers/trackerController';


const app = express();

// 1. CORS CONFIGURATION
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3005', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Rate limiters
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, // increased for dev
  message: { error: 'Too many requests, slow down!' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // increased for dev
  message: { error: 'Too many login attempts!' }
});

app.use('/api/v1', limiter);
app.use('/api/v1/auth', authLimiter);

// 3. Main middlewares
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    },
}));
app.use(passport.initialize());
app.use(passport.session());

// 4. Routes
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), service: 'UpGuard Backend' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/websites', websiteRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.get('/tracker.js', getTrackerScript);

scheduleReports();

// Handle 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message 
    })
  });
});

export default app;