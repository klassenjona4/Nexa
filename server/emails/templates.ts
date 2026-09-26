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

export function reminderEmail(opts: { to: string; name: string; tasks: { title: string; due: string; group: string }[]; link: string }): EmailMessage {
  const one = opts.tasks.length === 1;
  const { html, text } = renderEmail({
    label: 'Reminder',
    heading: one ? 'A task is due within 48 hours' : `${opts.tasks.length} tasks are due within 48 hours`,
    blocks: [
      { kind: 'p', text: `${opts.name ? `${opts.name}, t` : 'T'}he following ${one ? 'task is' : 'tasks are'} assigned to you and not marked as done:` },
      ...opts.tasks.map((t) => ({ kind: 'p' as const, text: `${t.title} · ${t.group} · due ${t.due}` })),
      { kind: 'button', label: 'Open your tasks', href: opts.link },
      { kind: 'small', text: 'You receive this reminder once for each task, 48 hours before it is due. Times are Irish time.' },
    ],
  });
  return { to: opts.to, subject: one ? `Due soon: ${opts.tasks[0]!.title}` : `${opts.tasks.length} tasks are due soon`, html, text };
}

export function retentionWarningEmail(opts: { to: string; group: string; project: string; deleteOn: string; link: string }): EmailMessage {
  const { html, text } = renderEmail({
    label: 'Project deletion',
    heading: `${opts.group} will be deleted on ${opts.deleteOn}`,
    blocks: [
      {
        kind: 'p',
        text: `There has been no activity in ${opts.project} for ${opts.group} for 23 days, and its final deadline has passed or is not set. Nexa deletes projects 30 days after the last activity or the final deadline, whichever is later.`,
      },
      { kind: 'p', text: `On ${opts.deleteOn} the project, its tasks, brief and contribution log are deleted for all members. Export the contribution statement first if you need it.` },
      { kind: 'button', label: 'Keep the project', href: opts.link },
      { kind: 'small', text: 'Any member can keep the project. Keeping it counts as activity.' },
    ],
  });
  return { to: opts.to, subject: `${opts.group} will be deleted on ${opts.deleteOn}`, html, text };
}
