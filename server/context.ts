import { createMiddleware } from 'hono/factory';
import { unauthorised } from './http.js';
import { type AuthUser, type Db, userClient, verifyAccessToken } from './supabase.js';

export type AppEnv = {
  Variables: {
    requestId: string;
    user: AuthUser;
    token: string;
    db: Db;
  };
};

// Verifies the Supabase access token and gives the route a client that acts as the user (RLS applies).
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match?.[1]) throw unauthorised();
  const token = match[1];
  const user = await verifyAccessToken(token);
  c.set('user', user);
  c.set('token', token);
  c.set('db', userClient(token));
  await next();
});
