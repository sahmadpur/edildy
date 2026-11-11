import { expect, type APIRequestContext, test } from '@playwright/test';
import { createOrg } from './org';

/** Sets up a tenant through the API: a site, a worker at it and a published checklist from a Edildy template. */
async function seedTenant(request: APIRequestContext, suffix: string) {
  const email = `sch-${suffix}@example.az`;
  const password = 'e2e owner password';
  const signup = await createOrg(request, { name: 'E2E Növbə MMC', orgCode: `e2e-sch-${suffix}`, email, password });
  const headers = { Authorization: `Bearer ${signup.accessToken}` };
  const call = async (method: string, url: string, data?: unknown) => {
    const res = await request.fetch(`/api/v1${url}`, { method, headers, data });
    expect(res.ok(), `${method} ${url}: ${await res.text()}`).toBeTruthy();
    return res.status() === 204 ? null : res.json();
  };
  const types = (await call('GET', '/site-types')) as Array<{ id: string; name: string }>;
  const site = await call('POST', '/sites', { parentId: null, typeId: types.find((x) => x.name === 'Filial')!.id, name: 'Anbar №1' });
  const roles = (await call('GET', '/roles')) as Array<{ id: string; systemKey: string | null }>;
  await call('POST', '/users/workers', { fullName: 'Nigar Səfərli', username: 'nigar', roleId: roles.find((r) => r.systemKey === 'worker')!.id, siteIds: [site.id] });
  const templates = (await call('GET', '/templates')) as Array<{ id: string; name: string; source: string }>;
  const template = templates.find((x) => x.source === 'global' && x.name === 'Gündəlik təmizlik yoxlaması')!;
  const checklist = await call('POST', '/checklists', { name: 'E2E açılış', from: { kind: 'global', templateId: template.id } });
  const draft = await call('GET', `/checklists/${checklist.id}/draft`);
  await call('POST', `/checklists/${checklist.id}/publish`, { revision: draft.revision });
  return { email, password };
}

test('owner sets up a shift and a roster, then assigns a checklist by shift', async ({ page, request }) => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const { email, password } = await seedTenant(request, suffix);

  await page.goto('/login');
  await page.getByLabel('E-poçt', { exact: true }).fill(email);
  await page.getByLabel('Şifrə', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Daxil ol' }).click();

  // Shift template. The menu opens Növbə cədvəli first (feedback 2026-11-11); the shift list is the second tab.
  await page.getByRole('link', { name: 'Növbələr' }).first().click();
  await expect(page.getByRole('navigation', { name: 'Növbələr' }).getByRole('link', { name: 'Növbə cədvəli' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('navigation', { name: 'Növbələr' }).getByRole('link', { name: 'Növbələr' }).click();
  await page.getByRole('button', { name: 'Yeni növbə' }).click();
  const shiftDialog = page.getByRole('dialog');
  await shiftDialog.getByLabel('Ad', { exact: true }).fill('Səhər');
  await shiftDialog.getByLabel('Başlama').fill('08:00');
  await shiftDialog.getByLabel('Bitmə').fill('16:00');
  await shiftDialog.getByRole('button', { name: 'Yadda saxla' }).click();
  await expect(page.getByRole('cell', { name: 'Səhər' })).toBeVisible();

  // Roster: Nigar on the morning shift all week.
  await page.getByRole('link', { name: 'Növbə cədvəli' }).click();
  await page.getByLabel('Obyekt').selectOption({ label: 'Anbar №1' });
  const cells = page.getByRole('checkbox', { name: /^Səhər — Nigar Səfərli, / });
  await expect(cells).toHaveCount(7);
  for (let i = 0; i < 7; i++) await cells.nth(i).click();
  await page.getByRole('button', { name: 'Yadda saxla' }).click();
  await expect(page.getByText('Növbə cədvəli yadda saxlanıldı')).toBeVisible();

  // Assignment with shift timing and a live preview (the Təyinatlar tab of Yoxlamalar).
  await page.getByRole('link', { name: 'Yoxlamalar' }).click();
  await page.getByRole('link', { name: 'Yeni təyinat' }).click();
  await page.getByLabel('Yoxlama vərəqəsi').selectOption({ label: 'E2E açılış' });
  await page.getByLabel('Obyekt').selectOption({ label: 'Anbar №1' });
  await page.getByRole('checkbox', { name: 'Nigar Səfərli' }).click();
  await page.getByRole('checkbox', { name: 'Növbəyə görə' }).click();
  const preview = page.getByRole('complementary', { name: 'Növbəti yoxlamalar' });
  await expect(preview.getByText('Hər gün, Səhər növbəsi')).toBeVisible();
  // The preview is a month calendar with the checks marked on their days (feedback 2026-11-08).
  await expect(preview.getByRole('button', { name: /, 1 yoxlama$/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Yadda saxla' }).click();

  // The assignment page opens; its runs show on the Yoxlama cədvəli month calendar.
  await expect(page.getByRole('heading', { name: 'E2E açılış' })).toBeVisible();
  await page.getByRole('link', { name: 'Yoxlamalar' }).click();
  await page.getByRole('link', { name: 'Yoxlama cədvəli' }).click();
  await expect(page.getByRole('gridcell').getByRole('button', { name: /E2E açılış/ }).first()).toBeVisible();

  // The old schedule page is gone (feedback 2026-11-11): its links land on Yoxlama cədvəli.
  await page.getByRole('link', { name: 'Yoxlamalar' }).click();
  await expect(page.getByRole('link', { name: 'İcra cədvəli' })).toHaveCount(0);
  await page.goto('/schedule');
  await expect(page).toHaveURL(/\/calendar/);
  await expect(page.getByRole('link', { name: 'Yoxlama cədvəli' })).toHaveAttribute('aria-current', 'page');
});
