import { expect, test } from '@playwright/test';
import { inviteToken, PLATFORM_ADMIN } from './org';

test('Edildy staff create an organisation; the owner accepts the invitation, creates a site and a worker, and finds the worker after logging back in', async ({
  page,
  request,
}) => {
  const suffix = Date.now().toString(36);
  const orgCode = `e2e-${suffix}`;
  const email = `owner-${suffix}@example.az`;
  const password = 'e2e owner password';

  // No self-registration: the platform admin creates the organisation on Basic and invites its owner.
  await page.goto('/platform/login');
  await page.getByLabel('E-poçt').fill(PLATFORM_ADMIN.email);
  await page.getByLabel('Şifrə').fill(PLATFORM_ADMIN.password);
  await page.getByRole('button', { name: 'Daxil ol' }).click();
  await page.getByRole('button', { name: 'Yeni təşkilat' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Təşkilatın adı').fill('E2E MMC');
  await dialog.getByLabel('Təşkilat kodu').fill(orgCode);
  await dialog.getByLabel('Sahibin adı və soyadı').fill('Elvin Əhmədov');
  await dialog.getByLabel('Sahibin e-poçtu').fill(email);
  await dialog.getByRole('button', { name: 'Yarat və dəvət göndər' }).click();
  await expect(page.getByRole('row', { name: new RegExp(orgCode) })).toContainText('Basic');

  // The owner sets a password through the invitation e-mail.
  await page.goto(`/accept-invite?token=${encodeURIComponent(await inviteToken(request, email))}`);
  await page.getByLabel('Şifrə', { exact: true }).fill(password);
  await page.getByLabel('Şifrəni təkrarlayın').fill(password);
  await page.getByRole('button', { name: 'Hesabı aktivləşdir' }).click();
  await expect(page.getByRole('heading', { name: 'Göstəricilər' })).toBeVisible();
  // Basic has no tasks (BR-01.03).
  await expect(page.getByRole('link', { name: 'Tapşırıqlar' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Obyektlər' }).click();
  await page.getByRole('button', { name: 'Yeni obyekt', exact: true }).click();
  await page.getByLabel('Ad', { exact: true }).fill('Anbar №1');
  await page.getByRole('button', { name: 'Yadda saxla' }).click();
  await expect(page.getByRole('treeitem').getByText('Anbar №1')).toBeVisible();

  await page.getByRole('link', { name: 'Əməkdaşlar' }).click();
  await page.getByRole('button', { name: 'Yeni əməkdaş' }).click();
  await page.getByLabel('Ad və soyad').fill('Nigar Səfərli');
  await page.getByLabel('Login').fill('nigar');
  await page.getByRole('checkbox', { name: 'Anbar №1' }).check();
  await page.getByRole('button', { name: 'Yarat' }).click();
  await expect(page.getByText('Giriş məlumatları')).toBeVisible();
  await expect(page.getByText(orgCode)).toBeVisible();
  await page.getByRole('button', { name: 'Hazırdır' }).click();

  await page.getByRole('button', { name: 'Çıxış' }).click();
  await expect(page.getByRole('heading', { name: 'Edildy-yə daxil olun' })).toBeVisible();
  await page.getByLabel('E-poçt', { exact: true }).fill(email);
  await page.getByLabel('Şifrə', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Daxil ol' }).click();
  await page.getByRole('link', { name: 'Əməkdaşlar' }).click();
  await expect(page.getByRole('cell', { name: /Nigar Səfərli/ })).toBeVisible();
});
