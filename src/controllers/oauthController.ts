import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWTSECRET, CLIENT_URL } from '../lib/config';

export const googleCallback = (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    
    if (!user) {
      return res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }

    const token = jwt.sign(
      { sub: user.id },
      JWTSECRET,
      { expiresIn: '7d' }
    );

    res.redirect(`${CLIENT_URL}/auth/success?token=${token}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${CLIENT_URL}/login?error=server_error`);
  }
};

export const googleAuth = () => {
  
};