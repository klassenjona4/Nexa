// Plain transactional emails in the Nexa style: Ink on White, square button, no images, no tracking.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Block = { kind: 'p'; text: string } | { kind: 'button'; label: string; href: string } | { kind: 'small'; text: string };

export function renderEmail(opts: { label: string; heading: string; blocks: Block[] }): { html: string; text: string } {
  const body = opts.blocks
    .map((b) => {
      if (b.kind === 'p') return `<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#141414">${escapeHtml(b.text)}</p>`;
      if (b.kind === 'small') return `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#4A4D4A">${escapeHtml(b.text)}</p>`;
      return `<p style="margin:8px 0 24px"><a href="${escapeHtml(b.href)}" style="display:inline-block;padding:14px 24px;background:#141414;color:#F7F7F5;font-family:Arial,sans-serif;font-weight:600;font-size:16px;text-decoration:none">${escapeHtml(b.label)}</a></p>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en-IE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#F7F7F5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5"><tr><td style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-top:1px solid #141414"><tr><td style="padding:32px 24px">
<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4A4D4A">${escapeHtml(opts.label)}</p>
<h1 style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:24px;line-height:1.2;font-weight:600;color:#141414">${escapeHtml(opts.heading)}</h1>
${body}
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:12px;color:#4A4D4A">Nexa · Group assignment planner</p>
</td></tr></table>
</body></html>`;

  const text = [
    opts.heading,
    '',
    ...opts.blocks.map((b) => (b.kind === 'button' ? `${b.label}: ${b.href}` : b.text)),
    '',
    'Nexa · Group assignment planner',
  ].join('\n\n');

  return { html, text };
}
