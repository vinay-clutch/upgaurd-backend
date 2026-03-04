import express, { Response, Request, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import cors from 'cors';
import passport from './config/passport';
import { authRouter } from './routes/authRouter';
import { websiteRouter } from './routes/websiteRouter';
import { analyticsRouter } from './routes/analyticsRouter';
import { getTrackerScript } from './controllers/trackerController';
import { SESSION_SECRET } from './lib/config';
import { scheduleReports } from './services/reportScheduler';
import { RedisStore } from 'connect-redis';
import { createRedisClient } from './redis';

const app = express();

app.set('trust proxy', 1);

app.get("/", (req, res) => {
  res.status(200).send("Backend is running");
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

const redisClient = createRedisClient();
redisClient.connect().catch(err => console.error('Redis error:', err));

const redisStore = new RedisStore({
  client: redisClient,
  prefix: "upguard_sess:",
});

const allowedOrigins = [
  "https://upgaurd-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(cors({
  origin: function (origin: any, callback: any) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.options('*', cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many login attempts' }
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);

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

app.use('/api/auth', authRouter);
app.use('/api/websites', websiteRouter);
app.use('/api/analytics', analyticsRouter);
app.get('/tracker.js', getTrackerScript);

setImmediate(() => {
  try {
    scheduleReports();
  } catch (err) {
    console.error("Scheduler error:", err);
  }
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
