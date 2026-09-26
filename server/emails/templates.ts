import type { EmailMessage } from '../services/email.js';
import { renderEmail } from './layout.js';

export function signInEmail(to: string, link: string): EmailMessage {
  const { html, text } = renderEmail({
    label: 'Sign in',
    heading: 'Your Nexa sign in link',
    blocks: [
      { kind: 'p', text: 'Select the button below to sign in to Nexa. The link works once and expires after 15 minutes.' },
      { kind: 'button', label: 'Sign in to Nexa', href: link },
      { kind: 'small', text: 'If you did not request this email, you can ignore it. Nobody can sign in without the link.' },
    ],
  });
  return { to, subject: 'Your Nexa sign in link', html, text };
}
