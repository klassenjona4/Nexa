import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createGroup, signIn, uniqueEmail } from './helpers.js';

async function briefPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('MDIA7012 Assignment 2: Case study report, 3,000 words. Due 14/11/2030 17:00.', { x: 40, y: 780, size: 10, font });
  return Buffer.from(await doc.save());
}

test('upload a brief PDF, review it and create the proposed tasks', async ({ page }) => {
  await signIn(page, uniqueEmail('brief'), 'Aoife Byrne');
  const projectId = await createGroup(page, 'Brief test group', 'Assignment 2');
  await expect(page.getByRole('heading', { name: 'Upload the assignment brief' })).toBeVisible();
  await expect(page.getByText('Brief breakdowns used: 0 of 5.')).toBeVisible();

  // A file that is not a PDF is refused before upload.
  await page.locator('input[type=file]').setInputFiles({ name: 'brief.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not really a pdf') });
  await expect(page.getByText('Error: The file is not a PDF.', { exact: false })).toBeVisible();

  await page.locator('input[type=file]').setInputFiles({ name: 'MDIA7012 brief.pdf', mimeType: 'application/pdf', buffer: await briefPdf() });
  await expect(page.getByRole('heading', { name: 'Check the extracted brief' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Deliverable', { exact: true }).first()).toHaveValue('Written case study report');

  await page.getByRole('button', { name: 'Save and propose tasks' }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${projectId}/proposal`));
  await expect(page.getByRole('heading', { name: 'Proposed tasks and split' })).toBeVisible();
  await page.getByLabel('Task 1', { exact: true }).fill('Research Irish defamation case law');
  await page.getByRole('button', { name: 'Create 10 tasks' }).click();

  await expect(page).toHaveURL(new RegExp(`/p/${projectId}/board`));
  await expect(page.getByText('10 tasks created and added to the board.')).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) >= 600) {
    await expect(page.getByRole('link', { name: /Research Irish defamation case law/ })).toBeVisible();
  } else {
    await expect(page.getByRole('tab', { name: 'To do (10)' })).toBeVisible();
  }

  // The brief page now shows the checked brief and the usage count.
  await page.goto(`/p/${projectId}/brief`);
  await expect(page.getByText('Written case study report')).toBeVisible();
  await expect(page.getByText('4 brief breakdowns left.', { exact: false })).toBeVisible();
});
