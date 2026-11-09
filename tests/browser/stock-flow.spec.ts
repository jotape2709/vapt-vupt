import { test, expect, type Page } from '@playwright/test';

async function enter(page: Page) {
 await page.goto('/');
 await page.getByRole('button', { name: 'Explorar demonstração', exact: true }).click();
}
const noPageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('encontrar ou cadastrar → registrar entrada → conferir saldo e histórico', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 await enter(page);
 await page.getByRole('button', { name: /^Estoque/ }).click();
 await page.getByRole('searchbox', { name: 'Buscar produto' }).fill('pão de queijo');
 await expect(page.getByRole('heading', { name: 'Nenhum produto para “pão de queijo”' })).toBeVisible();
 await expect(page.getByRole('status').filter({ hasText: 'Mostrando 0 de 0 resultados · 6 produtos no catálogo' })).toBeVisible();

 await page.getByRole('button', { name: 'Cadastrar “pão de queijo”' }).click();
 const dialog = page.getByRole('dialog', { name: 'Novo produto' });
 await expect(dialog.getByLabel('Nome do produto')).toHaveValue('pão de queijo');
 await expect(dialog.getByLabel('Nome do produto')).toBeFocused();
 await dialog.getByLabel('Código interno').fill('AUR-001');
 await dialog.getByLabel('Categoria').fill('Congelados');
 await dialog.getByLabel('Estoque mínimo').fill('10');
 await dialog.getByRole('button', { name: 'Salvar produto' }).click();
 await expect(dialog.getByLabel('Código interno')).toHaveAccessibleDescription('Este código já existe nesta empresa.');
 await expect(dialog.getByLabel('Código interno')).toBeFocused();
 await dialog.getByLabel('Código interno').fill('AUR-007');
 await dialog.getByRole('button', { name: 'Salvar produto' }).click();
 await expect(dialog).not.toBeVisible();

 const notice = page.getByRole('status').filter({ hasText: 'pão de queijo cadastrado com saldo 0 un.' });
 await expect(notice).toBeVisible();
 await expect(page.getByRole('row').filter({ hasText: 'AUR-007' })).toContainText('0 un');
 await notice.getByRole('button', { name: 'Registrar entrada' }).click();

 const move = page.getByRole('dialog', { name: 'Registrar movimentação' });
 await expect(move.getByLabel('Produto')).toHaveValue(/.+/);
 await expect(move.getByLabel('Produto').locator('option:checked')).toContainText('AUR-007');
 await expect(move.getByRole('radio', { name: 'Entrada' })).toBeChecked();
 await expect(move.getByLabel(/^Quantidade/)).toBeFocused();
 await move.getByLabel(/^Quantidade/).fill('24');
 await expect(move.locator('.balance-preview')).toContainText('Após a entrada24 un');
 await move.getByRole('button', { name: 'Recebimento de fornecedor' }).click();
 await expect(move.getByLabel('Motivo', { exact: true })).toHaveValue('Recebimento de fornecedor');
 await move.getByRole('button', { name: 'Registrar entrada', exact: true }).click();
 await expect(move).not.toBeVisible();

 const confirmation = page.getByRole('status').filter({ hasText: 'Entrada registrada na demonstração' });
 await expect(confirmation).toContainText('+24 un de pão de queijo. Saldo 0 → 24 un.');
 await expect(page.getByRole('row').filter({ hasText: 'AUR-007' })).toContainText('24 un');
 await confirmation.getByRole('button', { name: 'Ver histórico' }).click();
 await expect(page.getByRole('heading', { level: 1, name: 'Movimentações' })).toBeVisible();
 const entry = page.locator('.movement-list li').filter({ hasText: 'pão de queijo' });
 await expect(entry).toContainText('Recebimento de fornecedor');
 await expect(entry).toContainText('Saldo 0 → 24');

 await page.reload();
 await expect(page).toHaveURL(/\/demo$/);
 await expect(page.locator('.recent .movement-list')).toContainText('pão de queijo');
 await expect(page.getByText('Movimentações registradas').locator('..')).toContainText('1');
 expect(await noPageOverflow(page)).toBe(true);
 expect(errors).toEqual([]);
});

test('teclado: validação foca o campo, Esc fecha e o foco volta para a ação', async ({ page }) => {
 await enter(page);
 const open = page.getByRole('button', { name: 'Registrar movimentação', exact: true });
 await open.focus();
 await page.keyboard.press('Enter');
 const dialog = page.getByRole('dialog', { name: 'Registrar movimentação' });
 await expect(dialog).toBeVisible();
 await expect(dialog.getByLabel('Produto')).toBeFocused();
 await dialog.getByRole('button', { name: 'Registrar entrada', exact: true }).click();
 const quantity = dialog.getByLabel(/^Quantidade/);
 await expect(quantity).toHaveAttribute('aria-invalid', 'true');
 await expect(quantity).toBeFocused();
 await expect(dialog.getByLabel('Motivo', { exact: true })).toHaveAccessibleDescription(/pelo menos 3 caracteres/);
 await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();
 await expect(open).toBeFocused();
});

test('ação da linha abre saída do produto com prévia e bloqueio acima do saldo', async ({ page }) => {
 await enter(page);
 await page.getByRole('button', { name: /^Estoque/ }).click();
 await page.getByRole('button', { name: 'Registrar saída de Arroz branco · 5 kg' }).click();
 const dialog = page.getByRole('dialog', { name: 'Registrar movimentação' });
 await expect(dialog.getByRole('radio', { name: 'Saída' })).toBeChecked();
 await dialog.getByLabel(/^Quantidade/).fill('3');
 await expect(dialog.locator('.balance-preview')).toContainText('Saldo atual8 un');
 await expect(dialog.locator('.balance-preview')).toContainText('Após a saída5 un');
 await dialog.getByLabel(/^Quantidade/).fill('9');
 await dialog.getByRole('button', { name: 'Venda no balcão' }).click();
 await dialog.getByRole('button', { name: 'Registrar saída', exact: true }).click();
 await expect(dialog.getByLabel(/^Quantidade/)).toHaveAccessibleDescription('A saída não pode ser maior que o saldo disponível (8 un).');
 await dialog.getByLabel(/^Quantidade/).fill('3');
 await dialog.getByRole('button', { name: 'Registrar saída', exact: true }).click();
 await expect(page.getByRole('row').filter({ hasText: 'AUR-001' })).toContainText('5 un');
 await expect(page.getByRole('button', { name: 'Registrar saída de Arroz branco · 5 kg' })).toBeFocused();
});

test('empresa nova sem produtos orienta o cadastro em vez de exibir formulário vazio', async ({ page }) => {
 await enter(page);
 await page.getByRole('button', { name: 'Criar empresa demo' }).click();
 await page.getByLabel('Nome da empresa').fill('Mercado do Bairro');
 await page.getByRole('button', { name: 'Criar ambiente demonstrativo' }).click();
 await expect(page.locator('.topbar')).toContainText('Mercado do Bairro');
 await expect(page.getByRole('heading', { name: 'Nenhum produto cadastrado' })).toBeVisible();
 await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click();
 const dialog = page.getByRole('dialog', { name: 'Registrar movimentação' });
 await expect(dialog).toContainText('Esta empresa ainda não tem produtos.');
 await dialog.getByRole('button', { name: 'Cadastrar produto' }).click();
 await expect(page.getByRole('dialog', { name: 'Novo produto' })).toBeVisible();
});

test('três empresas em claro e escuro: diálogo segue o tema e a empresa ativa é anunciada', async ({ page }) => {
 await enter(page);
 const selector = page.getByLabel('Selecionar empresa demonstrativa');
 for (const [id, name] of [['mercado', 'Mercado Aurora'], ['adega', 'Adega Vértice'], ['bar', 'Bar da Esquina']]) {
  await selector.selectOption(id);
  await expect(page.getByRole('status').filter({ hasText: `Você está vendo ${name}` })).toBeVisible();
  for (let i = 0; i < 2; i++) {
   await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click();
   const colors = await page.evaluate(() => {
    const d = document.querySelector('dialog')!, w = document.querySelector('.workspace')!;
    const probe = document.createElement('div'); probe.style.background = 'var(--surface)'; w.appendChild(probe);
    const surface = getComputedStyle(probe).backgroundColor; probe.remove();
    return { dialog: getComputedStyle(d).backgroundColor, surface };
   });
   expect(colors.dialog).toBe(colors.surface);
   await page.keyboard.press('Escape');
   await page.getByRole('button', { name: /Ativar modo (claro|escuro)/ }).click();
  }
  expect(await noPageOverflow(page)).toBe(true);
 }
});

/*
 * O que este teste verifica: o layout num viewport de 720 × 500 pixels CSS com densidade 2,
 * que é a geometria que o Chromium produz ao aplicar zoom de 200% numa janela de 1440 × 1000.
 * O que ele NÃO verifica: o controle de zoom do navegador (Ctrl +), o zoom só de texto e
 * a ampliação por pinça. Esses itens continuam como verificação manual (docs/PRODUCT-CYCLE-02.md).
 */
test.describe('geometria equivalente a zoom de 200%', () => {
 test.use({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2 });
 test('viewport de 720 × 500 CSS px com DPR 2 mantém ações e tabela contidas', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: /^Estoque/ }).click();
  expect(await noPageOverflow(page)).toBe(true);
  const region = page.getByRole('region', { name: 'Tabela de produtos com rolagem horizontal' });
  const box = (await region.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(721);
  const action = page.getByRole('button', { name: 'Registrar entrada de Arroz branco · 5 kg' });
  const actionBox = (await action.boundingBox())!;
  expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
  await action.click();
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Registrar entrada', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
 });
});

test('nomes longos não criam rolagem horizontal da página em 320 px', async ({ page }) => {
 await page.setViewportSize({ width: 320, height: 800 });
 await enter(page);
 await page.getByRole('button', { name: /^Produtos/ }).click();
 await page.getByRole('button', { name: 'Novo produto' }).click();
 await page.getByLabel('Nome do produto').fill('Biscoito recheado sabor chocolate com avelã embalagem família 400 g');
 await page.getByLabel('Código interno').fill('AUR-LONGO-0001');
 await page.getByLabel('Categoria').fill('Biscoitos e salgadinhos');
 await page.getByRole('button', { name: 'Salvar produto' }).click();
 await expect(page.getByRole('row').filter({ hasText: 'AUR-LONGO-0001' })).toBeVisible();
 expect(await noPageOverflow(page)).toBe(true);
 await page.getByRole('button', { name: /^Estoque/ }).click();
 const action = page.getByRole('button', { name: 'Registrar entrada de Arroz branco · 5 kg' });
 await expect(action).toBeInViewport();
 expect(await noPageOverflow(page)).toBe(true);
});
