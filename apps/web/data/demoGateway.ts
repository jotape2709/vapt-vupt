import { ThemeSchema } from '../../../packages/domain';
import type {
 MovementCreate, MovementPage, MovementQuery, MovementRecord, OrgSettings, ProductCreate, SettingsEnvelope, StockItem, StockPage, StockQuery
} from '../../../packages/domain/contracts';
import type { Business, DemoMovement } from '../demo';
import { filterProducts, isBelowMinimum, registerMovement } from '../inventory';
import { DEMO_LOGO_ID, segmentFromLabel, settingsToTheme, themeToSettings } from '../theme';
import type { Gateway } from './gateway';
import { RequestError } from './http';

const fail = (kind: ConstructorParameters<typeof RequestError>[0], message: string, extra: Partial<NonNullable<RequestError['body']>> = {}) =>
 new RequestError(kind, message, 409, { error: kind as never, message, ...extra });

/**
 * Sandbox da demonstração: empresas fictícias no navegador, com a mesma interface da API.
 * Não envia nada a servidor. persist() devolve false quando o navegador não permite salvar;
 * storageWarning informa isso à tela em vez de afirmar que salvou.
 */
export class DemoGateway implements Gateway {
 readonly mode = 'demo' as const;
 readonly unitId = 'demo-unit';
 storageWarning: string | null = null;
 private versions = new Map<string, number>();
 private settingsVersion = 1;
 private pendingLogos = new Map<string, string>();

 constructor(private business: Business, private readonly persist: (b: Business) => boolean) {}

 get organizationId() { return this.business.id; }
 get current() { return this.business; }

 private commit(next: Business) {
  this.business = next;
  this.storageWarning = this.persist(next) ? null : 'O navegador não permitiu salvar: a alteração vale só nesta aba e some ao recarregar.';
 }

 private item(p: Business['products'][number]): StockItem {
  return { id: p.id, name: p.name, sku: p.sku, unit: p.unit, minimum: p.minimum, category: p.category, quantity: p.quantity, stockVersion: this.versions.get(p.id) ?? 0, catalogVersion: 0 };
 }

 private record(m: DemoMovement): MovementRecord {
  const sku = this.business.products.find(p => p.id === m.productId)?.sku ?? '';
  return {
   eventId: m.id, organizationId: this.business.id, unitId: this.unitId, productId: m.productId, productName: m.product, productSku: sku,
   measure: m.unit, kind: m.kind, quantity: m.quantity, reason: m.reason, balanceBefore: m.before, balanceAfter: m.after,
   stockVersion: 0, recordedAt: m.at, actorName: 'Perfil demonstrativo'
  };
 }

 envelope(): SettingsEnvelope {
  const b = this.business;
  return {
   organizationId: b.id, version: this.settingsVersion, updatedAt: new Date(0).toISOString(),
   settings: themeToSettings(b.theme, segmentFromLabel(b.segment), b.products.map(p => p.category), b.extras),
   logoUrl: b.theme.logo ?? null
  };
 }

 async listStock(q: StockQuery): Promise<StockPage> {
  const status = q.status ?? 'all', limit = q.limit ?? 50, offset = Number(q.cursor ?? 0) || 0;
  const sorted = [...this.business.products].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const all = filterProducts(sorted, q.q ?? '', 'all');
  const visible = filterProducts(sorted, q.q ?? '', status);
  const critical = all.filter(isBelowMinimum).length;
  return {
   organizationId: this.business.id, unitId: this.unitId,
   items: visible.slice(offset, offset + limit).map(p => this.item(p)),
   nextCursor: offset + limit < visible.length ? String(offset + limit) : null,
   counts: { all: all.length, critical, ok: all.length - critical, catalog: this.business.products.length }
  };
 }

 async createProduct(input: ProductCreate): Promise<StockItem> {
  const prior = this.business.products.find(p => p.id === input.id);
  if (prior) return this.item(prior);
  if (this.business.products.some(p => p.sku.toLocaleLowerCase('pt-BR') === input.sku.toLocaleLowerCase('pt-BR'))) {
   throw fail('duplicate_sku', 'Este código já existe nesta empresa.', { fields: { sku: 'Este código já existe nesta empresa.' } });
  }
  if (this.business.products.length >= 1000) throw fail('validation', 'A demonstração aceita até 1.000 produtos por empresa.');
  const product = { ...input, quantity: 0 };
  this.commit({ ...this.business, products: [...this.business.products, product] });
  return this.item(product);
 }

 async move(m: MovementCreate) {
  const prior = this.business.movements.find(x => x.id === m.eventId);
  if (prior) return { status: 'confirmed' as const, replayed: true, movement: this.record(prior) };
  const product = this.business.products.find(p => p.id === m.productId);
  if (!product) throw new RequestError('not_found', 'Produto não encontrado nesta empresa.', 404);
  const version = this.versions.get(product.id) ?? 0;
  const current = { quantity: product.quantity, stockVersion: version };
  if (version !== m.expectedVersion) throw fail('version_conflict', 'O saldo deste produto mudou desde que você abriu o formulário. Confira o saldo atual antes de registrar.', { current });
  let next;
  try { next = registerMovement(this.business, m, m.eventId, new Date()); }
  catch (e) { throw fail('insufficient_balance', e instanceof Error ? e.message : 'Saldo insuficiente.', { current }); }
  this.versions.set(product.id, version + 1);
  this.commit(next.business);
  return { status: 'confirmed' as const, replayed: false, movement: { ...this.record(next.movement), stockVersion: version + 1 } };
 }

 async findMovement(eventId: string) {
  const m = this.business.movements.find(x => x.id === eventId);
  return m ? this.record(m) : null;
 }

 async listMovements(q: MovementQuery): Promise<MovementPage> {
  const limit = q.limit ?? 50, offset = Number(q.cursor ?? 0) || 0;
  const visible = this.business.movements.filter(m => (!q.productId || m.productId === q.productId) && (!q.kind || m.kind === q.kind));
  return {
   organizationId: this.business.id, unitId: this.unitId, total: visible.length,
   items: visible.slice(offset, offset + limit).map(m => this.record(m)),
   nextCursor: offset + limit < visible.length ? String(offset + limit) : null
  };
 }

 async saveSettings(expectedVersion: number, settings: OrgSettings) {
  if (expectedVersion !== this.settingsVersion) throw fail('settings_conflict', 'A configuração mudou. Recarregue e revise.');
  const logoId = settings.identity.logoAssetId;
  const logo = !logoId ? undefined : logoId === DEMO_LOGO_ID ? this.business.theme.logo : this.pendingLogos.get(logoId);
  const theme = ThemeSchema.parse(settingsToTheme(settings, logo));
  this.commit({ ...this.business, theme, extras: { navigation: settings.navigation, overview: settings.overview } });
  this.pendingLogos.clear();
  return this.envelope();
 }

 /** Na demonstração o logotipo fica no navegador; a validação real acontece só no servidor. */
 async uploadLogo(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 120000) throw fail('invalid_image', 'Use PNG, JPG ou WebP de até 120 KB.');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw fail('invalid_image', 'A imagem não pôde ser aberta.');
  const tooLarge = bitmap.width > 2048 || bitmap.height > 2048;
  bitmap.close();
  if (tooLarge) throw fail('invalid_image', 'Use uma imagem de até 2048 × 2048 pixels.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
   const reader = new FileReader();
   reader.onload = () => resolve(String(reader.result));
   reader.onerror = () => reject(fail('invalid_image', 'Não foi possível ler a imagem.'));
   reader.readAsDataURL(file);
  });
  const id = crypto.randomUUID();
  this.pendingLogos.set(id, dataUrl);
  return { assetId: id, previewUrl: dataUrl };
 }

 /** Operações da demonstração são síncronas no navegador: não há resposta atrasada a descartar. */
 dispose() { /* nada pendente */ }
}
