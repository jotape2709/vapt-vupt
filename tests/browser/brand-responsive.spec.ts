import { test, expect } from '@playwright/test';

for (const width of [320, 360, 390, 768, 1024, 1440]) {
  test(`marca azul e conteúdo utilizável em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const enter=page.getByRole('button',{name:'Explorar demonstração',exact:true});
    await expect(enter).toHaveCSS('background-color','rgb(23, 76, 222)');
    await expect(page.locator('.public-nav svg[data-logo="vv-ribbon-v3"]')).toBeVisible();
    const clipped=await page.locator('.hero h1').evaluate(el=>{
      const range=document.createRange();range.selectNodeContents(el);
      return [...range.getClientRects()].some(r=>r.left < -1 || r.right > window.innerWidth+1);
    });
    expect(clipped,'título não pode ser cortado pelo overflow da landing').toBe(false);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const cta=await enter.boundingBox();expect(cta?.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:info.outputPath(`site-${width}.png`),fullPage:true});

    await enter.click();
    await expect(page.locator('.workspace')).toHaveAttribute('data-accent','blue');
    await expect(page.locator('.brand-button svg[data-logo="vv-ribbon-v3"]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Personalização',exact:true}).click();
    await page.getByLabel('Nome exibido',{exact:true}).fill('MercadoComNomeLongoParaConferirResponsividadeSemCortes');
    await page.getByRole('button',{name:'Salvar personalização'}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByRole('button',{name:/^Estoque/}).click();
    const region=page.getByRole('region',{name:'Tabela de produtos com rolagem horizontal'});
    await expect(region).toBeVisible();
    const tableBox=await region.boundingBox();expect(tableBox!.x+tableBox!.width).toBeLessThanOrEqual(width+1);
    await page.getByRole('button',{name:'Registrar movimentação',exact:true}).click();
    const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
    const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`dialog-${width}.png`),fullPage:true});
  });
}

test('preferências antigas migram para azul sem perder o saldo',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Explorar demonstração',exact:true}).click();
  await page.getByRole('button',{name:'Personalização',exact:true}).click();
  await page.getByRole('button',{name:'Salvar personalização'}).click();
  await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('vv-demo-v1')!);
    data[0].theme.accent='forest';data[0].products[0].quantity=71;
    data[1].theme.accent='wine';data[2].theme.accent='copper';
    localStorage.setItem('vv-demo-v1',JSON.stringify(data));
  });
  await page.reload();await page.getByRole('button',{name:'Explorar demonstração',exact:true}).click();
  const select=page.getByLabel('Selecionar empresa demonstrativa');
  for(const [id,accent] of [['mercado','blue'],['adega','navy'],['bar','sky']]){
    await select.selectOption(id);await expect(page.locator('.workspace')).toHaveAttribute('data-accent',accent);
  }
  await select.selectOption('mercado');
  await page.getByRole('button',{name:/^Estoque/}).click();
  await page.getByRole('searchbox',{name:'Buscar produto'}).fill('AUR-001');
  await expect(page.getByRole('row').filter({hasText:'AUR-001'})).toContainText('71');
});
