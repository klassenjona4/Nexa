import { app } from '../server/app.js';

// Same app as api/index.ts, deployed as a separate function with a longer time limit for AI calls.
export default { fetch: app.fetch };
