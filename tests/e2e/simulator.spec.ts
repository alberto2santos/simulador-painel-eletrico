import { expect, test } from '@playwright/test';

test('parte, publica telemetria e para o motor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'LIGAR' }).click();
  await expect(page.locator('.status-pill')).toHaveText('EM OPERAÇÃO', { timeout: 6000 });
  await expect(page.locator('.broker-status')).toContainText(/PACOTES/);
  await page.getByRole('button', { name: 'PARAR', exact: true }).click();
  await expect(page.locator('.status-pill')).toHaveText('PARADO');
});

test('dispara uma falta de fase e permite reset', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Teste de proteção' }).selectOption('phase-loss');
  await page.getByRole('button', { name: 'LIGAR' }).click();
  await expect(page.getByRole('alert')).toContainText('FALTA DE FASE');
  await page.getByRole('button', { name: 'RESETAR PAINEL' }).click();
  await expect(page.locator('.status-pill')).toHaveText('PARADO');
});

test('publica o manifest de instalação da PWA', async ({ page }) => {
  await page.goto('/');
  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(manifestResponse.json()).resolves.toMatchObject({ display: 'standalone', start_url: '/' });
});