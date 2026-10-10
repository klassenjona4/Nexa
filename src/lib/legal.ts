// Parses the constrained Markdown used in legal/*.md: front matter, one > notice, ## sections,
// paragraphs and - lists. No HTML is interpreted.
export type LegalBlock = { type: 'p'; text: string } | { type: 'ul'; items: string[] };
export type LegalDoc = {
  title: string;
  status: string;
  version: string;
  updated: string;
  notice: string;
  sections: { heading: string; blocks: LegalBlock[] }[];
};

export function parseLegal(raw: string): LegalDoc {
  const text = raw.replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const meta: Record<string, string> = {};
  for (const line of (fm?.[1] ?? '').split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (m?.[1]) meta[m[1]] = m[2] ?? '';
  }
  const body = fm ? text.slice(fm[0].length) : text;
  const doc: LegalDoc = { title: meta.title ?? '', status: meta.status ?? '', version: meta.version ?? '', updated: meta.updated ?? '', notice: '', sections: [] };
  let current: LegalDoc['sections'][number] | null = null;
  for (const chunk of body.split(/\n{2,}/)) {
    const block = chunk.trim();
    if (!block) continue;
    if (block.startsWith('> ')) {
      doc.notice = block.replace(/^>\s?/gm, '').trim();
    } else if (block.startsWith('## ')) {
      current = { heading: block.slice(3).trim(), blocks: [] };
      doc.sections.push(current);
    } else if (current && block.split('\n').every((l) => l.startsWith('- '))) {
      current.blocks.push({ type: 'ul', items: block.split('\n').map((l) => l.slice(2).trim()) });
    } else if (current) {
      current.blocks.push({ type: 'p', text: block.replace(/\n/g, ' ') });
    }
  }
  return doc;
}
