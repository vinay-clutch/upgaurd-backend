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
import { RedisStore } from 'connect-redis';
import { createRedisClient } from './redis';

const app = express();

// Trust proxy for Railway/Vercel (required for secure cookies)
app.set('trust proxy', 1);

app.get("/", (req, res) => {
  res.status(200).send("Backend is running");
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Initialize Redis client for sessions
const redisClient = createRedisClient();
redisClient.connect().catch(err => console.error('Redis Session Store Connection Error:', err));

const redisStore = new RedisStore({
  client: redisClient,
  prefix: "upguard_sess:",
});

//
// 1. CORS CONFIGURATION (Robust Dynamic Origin)
const allowedOrigins = [
  "https://upgaurd-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.CLIENT_URL || 'https://upgaurd-frontend.vercel.app'
];

app.use(cors({
  origin: function (origin: any, callback: any) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
app.options('*', cors());
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
    store: redisStore,
    secret: SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

//
// 4. (Moved To Top)
//

//
// 5. ROUTES
//
app.use(['/api/v1/auth', '/api/auth'], authRouter);
app.use(['/api/v1/websites', '/api/websites'], websiteRouter);
app.use(['/api/v1/analytics', '/api/analytics'], analyticsRouter);
app.get('/tracker.js', getTrackerScript);

//
// 6. BACKGROUND JOB
//
setImmediate(() => {
  try {
    scheduleReports();
  } catch (err) {
    console.error("Report scheduler failed:", err);
  }
});

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
