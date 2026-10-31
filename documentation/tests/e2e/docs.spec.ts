import { expect, test, type Page } from '@playwright/test';

// Waits for hydration: clicking server-rendered HTML before React attaches handlers loses the click on slow CI runners.
async function open(page: Page, path: string) {
  const res = await page.goto(path);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

const isMobile = (name: string) => name === 'mobile';

test('home: hero, official logo, CTAs and version', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Construa integrações com a APASBAC.');
  await expect(page.getByAltText('APASBAC — Socorro Bicho')).toBeVisible();
  await expect(page.getByRole('link', { name: /Começar/ })).toHaveAttribute('href', '/docs/inicio/primeiros-passos');
  await expect(page.getByRole('link', { name: 'Explorar a API' })).toHaveAttribute('href', '/api-reference');
  await expect(page.getByText(/APASBAC API v1\.1\.0/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});

test('navigation: sidebar marks the current page and breadcrumbs follow', async ({ page }, info) => {
  test.skip(isMobile(info.project.name), 'sidebar is a drawer on mobile');
  await open(page, '/docs/inicio/introducao');
  await page.getByRole('navigation', { name: 'Documentação' }).getByRole('link', { name: 'Paginação' }).click();
  await expect(page).toHaveURL(/\/docs\/fundamentos\/paginacao$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paginação');
  await expect(page.getByRole('navigation', { name: 'Documentação' }).locator('[aria-current="page"]')).toHaveText('Paginação');
  await expect(page.getByRole('navigation', { name: 'Trilha' })).toContainText('Fundamentos');
});

test('mobile menu opens the full navigation and closes on navigation', async ({ page }, info) => {
  test.skip(!isMobile(info.project.name));
  await open(page, '/');
  await page.getByTestId('mobile-menu').click();
  const dialog = page.getByRole('dialog', { name: 'Menu de navegação' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Limites de requisições' }).click();
  await expect(page).toHaveURL(/\/docs\/fundamentos\/limites$/);
  await expect(dialog).toBeHidden();
});

test('search: keyboard shortcut, results for endpoints, Enter navigates', async ({ page }) => {
  await open(page, '/docs/inicio/introducao');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox');
  await expect(input).toBeFocused();
  await input.fill('renovar access token');
  await expect(page.getByRole('option').first()).toContainText(/Renovar access token/i);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/api-reference\/autenticacao\/refresh$/);
});

test('theme: toggle switches to dark and survives reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '/docs/inicio/introducao');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('endpoint page: language tabs, copy button, sections', async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '/api-reference/autenticacao/login');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Login de usuário');
  for (const id of ['autenticacao', 'corpo', 'exemplos', 'resposta', 'erros', 'playground']) await expect(page.locator(`#${id}`)).toBeAttached();
  const tabs = page.getByRole('tablist', { name: 'Linguagem' }).first();
  for (const l of ['cURL', 'JavaScript', 'TypeScript', 'Axios', 'Python', 'PHP', 'Dart']) await expect(tabs.getByRole('tab', { name: l })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Python' }).click();
  await expect(page.getByRole('tabpanel').first()).toContainText('requests.post(');
  if (!isMobile(info.project.name)) {
    await page.getByRole('tabpanel').first().locator('..').getByRole('button', { name: 'Copiar código' }).first().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('requests.post(');
  }
});

test('playground: validates locally, requires confirmation and keeps tokens out of storage', async ({ page }) => {
  await open(page, '/playground');
  const pg = page.getByTestId('playground');
  await expect(pg.locator('code').first()).toContainText('http://localhost:3000/api/v1/animals');
  await page.getByLabel('Endpoint').selectOption({ label: 'POST /auth/logout — Encerrar sessão do usuário' });
  await page.getByTestId('playground-send').click();
  await expect(pg.getByRole('alert')).toHaveText('Este endpoint exige um access token.');
  await page.getByLabel(/Access token/).fill('token-de-teste');
  await page.getByTestId('playground-send').click();
  await expect(pg.getByRole('alert')).toContainText('Confirme');
  await page.getByLabel('Ambiente').selectOption({ label: 'Produção' });
  await expect(pg.getByText(/Ambiente de produção/)).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain('token-de-teste');
});

test('machine-readable files and security headers', async ({ request }) => {
  for (const [path, type] of [['/llms.txt', 'text/plain'], ['/llms-full.txt', 'text/plain'], ['/AGENTS.md', 'text/markdown'], ['/openapi.json', 'application/json'], ['/sitemap.xml', 'xml'], ['/robots.txt', 'text/plain']]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type'], path).toContain(type);
  }
  const spec = await (await request.get('/openapi.json')).json();
  expect(spec.openapi).toMatch(/^3\./);
  const home = await request.get('/');
  const csp = home.headers()['content-security-policy'];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/connect-src 'self' http:\/\/localhost:3000 https:\/\/apasbac-api\.vercel\.app/);
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['x-powered-by']).toBeUndefined();
});

test('accessibility basics and no horizontal overflow', async ({ page }) => {
  for (const path of ['/', '/docs/seguranca/autorizacao', '/api-reference/eventos/find-all', '/docs/eventos/exemplos', '/playground']) {
    await open(page, path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.locator('img:not([alt])').count(), path).toBe(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
  }
  await open(page, '/docs/inicio/introducao');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
});

test('unknown pages return 404 with guidance', async ({ page }) => {
  const res = await open(page, '/docs/nao-existe');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
});
