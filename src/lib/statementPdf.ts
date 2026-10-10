import fontkit from '@pdf-lib/fontkit';
import sansBoldUrl from '@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff?url';
import sansUrl from '@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff?url';
import serifUrl from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff?url';
import { PDFDocument, type PDFFont, rgb } from 'pdf-lib';

import type { StatementInput as Input } from './statementText';

const INK = rgb(0x14 / 255, 0x14 / 255, 0x14 / 255);
const GRAPHITE = rgb(0x4a / 255, 0x4d / 255, 0x4a / 255);
const SAGE = rgb(0xb7 / 255, 0xbf / 255, 0xb5 / 255);
const MM = 72 / 25.4;

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

// A4 statement in the design system's document style: 25/30 mm margins, Hanken Grotesk
// headings, Source Serif 4 body, 1pt Ink rules, signature lines for every member.
export async function statementPdf(input: Input): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [sansBytes, sansBoldBytes, serifBytes] = await Promise.all([sansUrl, sansBoldUrl, serifUrl].map((u) => fetch(u).then((r) => r.arrayBuffer())));
  const sans = await doc.embedFont(sansBytes!, { subset: true });
  const sansBold = await doc.embedFont(sansBoldBytes!, { subset: true });
  const serif = await doc.embedFont(serifBytes!, { subset: true });
  doc.setTitle(input.title);
  doc.setCreator('Nexa');

  const W = 210 * MM;
  const H = 297 * MM;
  const left = 30 * MM;
  const width = W - 60 * MM;
  let page = doc.addPage([W, H]);
  let y = H - 25 * MM;
  const need = (h: number) => {
    if (y - h < 25 * MM) {
      page = doc.addPage([W, H]);
      y = H - 25 * MM;
    }
  };
  const text = (t: string, font: PDFFont, size: number, color = INK, lead = size * 1.45) => {
    for (const line of wrap(t, font, size, width)) {
      need(lead);
      page.drawText(line, { x: left, y: y - size, size, font, color });
      y -= lead;
    }
  };

  text(input.label.toUpperCase(), sansBold, 8, GRAPHITE);
  y -= 4;
  text(input.title, sansBold, 20, INK, 24);
  text(input.period, sans, 9, GRAPHITE);
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness: 1, color: INK });
  y -= 18;

  for (const s of input.sections) {
    need(40);
    text(s.heading, sansBold, 11.5, INK, 16);
    y -= 2;
    text(s.body, serif, 11, INK, 16.5);
    y -= 12;
  }

  need(90);
  page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness: 0.5, color: SAGE });
  y -= 40;
  const col = width / 2;
  input.members.forEach((m, i) => {
    const x = left + (i % 2) * col;
    if (i % 2 === 0 && i > 0) y -= 58;
    need(58);
    page.drawLine({ start: { x, y }, end: { x: x + col - 24, y }, thickness: 1, color: INK });
    page.drawText(m, { x, y: y - 13, size: 9.5, font: sansBold, color: INK });
    page.drawText('Signature and date', { x, y: y - 26, size: 8.5, font: sans, color: GRAPHITE });
  });

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

