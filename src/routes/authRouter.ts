import express from 'express';
import passport from '../config/passport';
import { signin, signup, me, updateProfile, changePassword, deleteAccount } from '../controllers/authController';
import { googleCallback } from '../controllers/oauthController';
import { authMiddleware } from '../middlewares/authmiddleware';

export const authRouter = express.Router();

authRouter.post('/signup', signup);
authRouter.post('/signin', signin);
authRouter.get('/me', authMiddleware, me);
authRouter.put('/update-profile', authMiddleware, updateProfile);
authRouter.put('/change-password', authMiddleware, changePassword);
authRouter.delete('/delete-account', authMiddleware, deleteAccount);

authRouter.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRouter.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/signin'
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

export default authRouter;
