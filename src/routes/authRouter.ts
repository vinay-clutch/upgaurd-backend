import express from 'express';
import passport from '../config/passport';
import { signin, signup, me } from '../controllers/authController';
import { googleCallback } from '../controllers/oauthController';
import { authMiddleware } from '../middlewares/authmiddleware';
import { CLIENT_URL } from '../lib/config';

export const authRouter = express.Router();

authRouter.post('/signup', signup);
authRouter.post('/signin', signin);
authRouter.get('/me', authMiddleware, me);

authRouter.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRouter.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: `${CLIENT_URL}/login?error=oauth_failed` 
  }),
  googleCallback
);

authRouter.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});