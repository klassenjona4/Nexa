import { Resend } from 'resend';
import { flags, requireEnv } from '../env.js';
import { HttpError } from '../http.js';
import { log } from '../logger.js';

export type EmailMessage = { to: string; subject: string; text: string; html: string };

// In end to end tests (EMAIL_MOCK=1, never in production) messages are kept in memory
// so the tests can open the sign in and invite links.
const outbox: EmailMessage[] = [];

export function readOutbox(): EmailMessage[] {
  return outbox;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (flags.emailMock && !flags.production) {
    outbox.push(message);
    if (outbox.length > 200) outbox.shift();
    return;
  }
  const resend = new Resend(requireEnv('RESEND_API_KEY'));
  const { error } = await resend.emails.send({
    from: requireEnv('EMAIL_FROM'),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (error) {
    log({ event: 'email_failed', code: error.name });
    throw new HttpError(502, 'email_failed');
  }
}
