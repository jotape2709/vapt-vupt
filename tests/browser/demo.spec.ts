import { test, expect } from '@playwright/test';
test('três empresas, personalização e operação demonstrativa',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Seu comércio/})).toBeVisible();
 await page.screenshot({path:info.outputPath('landing.png'),fullPage:true});
 await page.getByRole('button',{name:'Explorar demonstração',exact:true}).click();
 const selector=page.getByLabel('Selecionar empresa demonstrativa');
 for(const [id,name,accent] of [['mercado','Mercado Aurora','forest'],['adega','Adega Vértice','wine'],['bar','Bar da Esquina','copper']]){
  await selector.selectOption(id);
  await expect(page.locator('.workspace')).toHaveAttribute('data-accent',accent);
  await expect(page.locator('.topbar')).toContainText(name);
  await expect(page.getByRole('heading',{name:'Vamos cuidar do seu estoque.'})).toBeVisible();
  await page.screenshot({path:info.outputPath(id+'.png'),fullPage:true});
 }
 await selector.selectOption('mercado');
 await page.getByRole('button',{name:'Registrar movimentação',exact:true}).click();
 await page.getByLabel('Quantidade',{exact:true}).fill('5');
 await page.getByLabel('Motivo',{exact:true}).fill('Recebimento demonstrativo');
 await page.getByRole('button',{name:'Registrar na demonstração'}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:/^Estoque/}).click();
 await page.getByRole('textbox',{name:'Buscar produto'}).fill('AUR-001');
 await expect(page.getByRole('row').filter({hasText:'AUR-001'})).toContainText('13');
 await page.getByRole('button',{name:'Personalização',exact:true}).click();
 await page.getByLabel('Nome exibido',{exact:true}).fill('Aurora Teste');
 await page.getByRole('button',{name:'Salvar personalização'}).click();
 await page.reload();
 await page.getByRole('button',{name:'Explorar demonstração',exact:true}).click();
 await expect(page.locator('.topbar')).toContainText('Aurora Teste');
 await expect(page.locator('.workspace')).toHaveAttribute('data-accent','forest');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 expect(overflow).toBe(false);
 expect(errors).toEqual([]);
});
test('saída acima do saldo fica no formulário e exibe erro',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Explorar demonstração',exact:true}).click();
 await page.getByRole('button',{name:'Registrar movimentação',exact:true}).click();
 await page.getByLabel('Operação',{exact:true}).selectOption('issue');
 await page.getByLabel('Quantidade',{exact:true}).fill('999');
 await page.getByLabel('Motivo',{exact:true}).fill('Teste de saída');
 await page.getByRole('button',{name:'Registrar na demonstração'}).click();
 await expect(page.getByRole('alert')).toContainText('A saída não pode ser maior');
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).not.toBeVisible();
});
