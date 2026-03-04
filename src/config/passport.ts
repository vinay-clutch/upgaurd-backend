import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import prisma from '../lib/db';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '../lib/config';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  console.log('✅ Google OAuth Enabled');
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        proxy: true,
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (error: any, user?: any | false | null) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          
          // 1. Try finding by google_id
          let user = await prisma.user.findUnique({
            where: { google_id: profile.id },
          });

          if (user) {
            return done(null, user);
          }

          // 2. If not found by google_id, try finding by email
          if (email) {
            user = await prisma.user.findUnique({
              where: { email },
            });

            if (user) {
              // Update user with google_id
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  google_id: profile.id,
                  auth_provider: 'google',
                  picture: profile.photos?.[0]?.value || null,
                  name: profile.displayName || null
                }
              });
              return done(null, user);
            }
          }

          // 3. Create new user if still not found
          user = await prisma.user.create({
            data: {
              email: email || '',
              username: profile.displayName ? `${profile.displayName}_${Math.random().toString(36).substr(2, 5)}` : profile.id,
              google_id: profile.id,
              name: profile.displayName || null,
              picture: profile.photos?.[0]?.value || null,
              auth_provider: 'google',
              password: '', // OAuth users don't need a password
            },
          });

          done(null, user);
        } catch (error) {
          console.error("Google OAuth Strategy Error:", error);
          done(error);
        }
      }
    )
  );
} else {
  console.log('⚠️ Google OAuth Disabled (No credentials)');
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
