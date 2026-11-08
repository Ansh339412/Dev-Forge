import { expect, test } from '@playwright/test';

const MAILHOG = process.env.MAILHOG_URL ?? 'http://localhost:8025';

/** Reads the single-use token from the latest email sent to `to` (MailHog may quoted-printable-wrap lines). */
async function tokenFromMail(request: import('@playwright/test').APIRequestContext, to: string, link: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await request.get(`${MAILHOG}/api/v2/search`, { params: { kind: 'to', query: to } });
    const body: string = (await res.json()).items?.[0]?.Content?.Body ?? '';
    const text = body.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
    const match = text.includes(link) && text.match(/token=([a-f0-9]+)/);
    if (match) return match[1];
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${link} email arrived for ${to}`);
}

test('a new user can sign up, verify, and plan work on a board', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = 'a-long-test-passphrase';

  await page.goto('/register');
  await page.getByLabel('Full name').fill('Ada Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const token = await tokenFromMail(request, email, 'verify-email');
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // First run: no workspace yet.
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
  await page.getByLabel('Name').fill('Acme Engineering');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Name').fill('Launch');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Launch' })).toBeVisible();

  const backlog = page.getByRole('region', { name: 'Backlog' });
  await backlog.getByRole('button', { name: 'Add task' }).click();
  await page.getByLabel('New Backlog task title').fill('Write the spec');
  await page.keyboard.press('Enter');
  await expect(backlog.getByText('Write the spec')).toBeVisible();

  // Open the task and move it to another column through the drawer.
  await backlog.getByText('Write the spec').click();
  await page.getByLabel('Status').selectOption('IN_PROGRESS');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('region', { name: 'In progress' }).getByText('Write the spec')).toBeVisible();
});
