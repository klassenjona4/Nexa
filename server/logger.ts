// Structured logs with an allow list of fields. Never log bodies, emails, names, IP addresses,
// tokens or brief content.
type LogFields = {
  event: string;
  route?: string;
  method?: string;
  status?: number;
  ms?: number;
  requestId?: string;
  code?: string;
  count?: number;
};

const ALLOWED = new Set(['event', 'route', 'method', 'status', 'ms', 'requestId', 'code', 'count']);

export function log(fields: LogFields): void {
  const safe: Record<string, unknown> = { t: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.has(k) && v !== undefined) safe[k] = v;
  }
  process.stdout.write(`${JSON.stringify(safe)}\n`);
}

// Route templates only: ids and tokens are replaced so paths carry no identifiers.
export function routeTemplate(path: string): string {
  return path
    .replace(/\/cal\/[^/]+/, '/cal/:token')
    .replace(/\/invites\/[A-Za-z0-9_-]{16,}/, '/invites/:code')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}
