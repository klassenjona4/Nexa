import { app } from '../server/app.js';

// Vercel Node.js function using the Web standard fetch handler. Rewrites in vercel.json send
// every /api and /cal request here except the AI routes.
export default { fetch: app.fetch };
