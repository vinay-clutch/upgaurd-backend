import express, { Response, Request, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import cors from 'cors';
import passport from './config/passport';
import { authRouter } from './routes/authRouter';
import { websiteRouter } from './routes/websiteRouter';
import { analyticsRouter } from './routes/analyticsRouter';
import { getTrackerScript } from './controllers/trackerController';
import { SESSION_SECRET, CLIENT_URL } from './lib/config';
import { scheduleReports } from './services/reportScheduler';

const app = express();

//
// 1. CORS CONFIGURATION (Production Ready)
//
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

//
// 2. RATE LIMITING
//
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, slow down!' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many login attempts!' }
});

app.use('/api/v1', limiter);
app.use('/api/v1/auth', authLimiter);

//
// 3. MIDDLEWARES
//
app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'none'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

//
// 4. HEALTH CHECK
//
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Antigravtiven Backend'
  });
});

//
// 5. ROUTES
//
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/websites', websiteRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.get('/tracker.js', getTrackerScript);

//
// 6. BACKGROUND JOB
//
scheduleReports();

//
// 7. 404 HANDLER
//
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

//
// 8. ERROR HANDLER
//
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // console.error('Unhandled error:', err); // Cleaned for production
  res.status(500).json({
    message: 'Internal server error'
  });
});

export default app;
