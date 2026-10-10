import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';

// Local development server for the API. Loads .env.local, then serves the same app as Vercel.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const { app } = await import('./app.js');
const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port });
process.stdout.write(`API listening on http://localhost:${port}\n`);
