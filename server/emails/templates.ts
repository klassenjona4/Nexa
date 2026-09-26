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

export function inviteEmail(opts: { to: string; inviterName: string; groupName: string; projectTitle: string; link: string; expires: string }): EmailMessage {
  const { html, text } = renderEmail({
    label: 'Invite',
    heading: `Join ${opts.groupName} on Nexa`,
    blocks: [
      {
        kind: 'p',
        text: `${opts.inviterName || 'A group owner'} invited you to join ${opts.groupName} for ${opts.projectTitle}. Nexa is used to plan the group assignment and record who completed each part.`,
      },
      { kind: 'button', label: 'Open the invite', href: opts.link },
      { kind: 'small', text: `The invite link expires on ${opts.expires}. It shows the project summary before you sign in.` },
      { kind: 'small', text: 'If you do not know the sender, you can ignore this email.' },
    ],
  });
  return { to: opts.to, subject: `Invite to join ${opts.groupName} on Nexa`, html, text };
}
