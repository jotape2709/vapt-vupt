import {
 LogoResultSchema, MovementPageSchema, MovementRecordSchema, MovementResultSchema, SettingsEnvelopeSchema,
 StockItemSchema, StockPageSchema, type MovementQuery, type StockQuery
} from '../../../packages/domain/contracts';
import type { Gateway } from './gateway';
import { RequestError, type ApiClient } from './http';

const query = (params: Record<string, string | number | undefined>) => {
 const search = new URLSearchParams();
 for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') search.set(k, String(v));
 const text = search.toString();
 return text ? '?' + text : '';
};

/**
 * Operação real pela API. Todas as requisições compartilham um AbortController da instância:
 * dispose() as cancela, e qualquer resposta que chegue depois é descartada (nunca exibida
 * em outra empresa). Respostas também precisam declarar a mesma organização.
 */
export class ApiGateway implements Gateway {
 readonly mode = 'live' as const;
 private readonly lifetime = new AbortController();
 constructor(private readonly api: ApiClient, readonly organizationId: string, readonly unitId: string) {}

 private signal(extra?: AbortSignal) { return extra ? AbortSignal.any([extra, this.lifetime.signal]) : this.lifetime.signal; }
 private guard<T>(value: T, organizationId?: string): T {
  if (this.lifetime.signal.aborted) throw new RequestError('aborted', 'Empresa trocada ou sessão encerrada.');
  if (organizationId && organizationId !== this.organizationId) throw new RequestError('invalid_response', 'Resposta de outra empresa descartada.');
  return value;
 }
 private get base() { return `/api/orgs/${this.organizationId}`; }
 private get unitBase() { return `${this.base}/units/${this.unitId}`; }

 async listStock(q: StockQuery, signal?: AbortSignal) {
  const page = await this.api.request(this.unitBase + '/stock' + query({ q: q.q, status: q.status, cursor: q.cursor, limit: q.limit }), StockPageSchema, { signal: this.signal(signal) });
  return this.guard(page, page.organizationId);
 }
 async createProduct(input: Parameters<Gateway['createProduct']>[0]) {
  return this.guard(await this.api.request(this.base + '/products', StockItemSchema, { method: 'POST', body: input, signal: this.signal() }));
 }
 async move(input: Parameters<Gateway['move']>[0]) {
  const result = await this.api.request(this.unitBase + '/movements', MovementResultSchema, { method: 'POST', body: input, signal: this.signal() });
  return this.guard(result, result.movement.organizationId);
 }
 async findMovement(eventId: string) {
  try {
   const record = await this.api.request(`${this.base}/movements/${eventId}`, MovementRecordSchema, { signal: this.signal() });
   return this.guard(record, record.organizationId);
  } catch (e) {
   if (e instanceof RequestError && e.kind === 'not_found') return this.guard(null);
   throw e;
  }
 }
 async listMovements(q: MovementQuery, signal?: AbortSignal) {
  const page = await this.api.request(this.unitBase + '/movements' + query({ productId: q.productId, kind: q.kind, cursor: q.cursor, limit: q.limit }), MovementPageSchema, { signal: this.signal(signal) });
  return this.guard(page, page.organizationId);
 }
 async saveSettings(expectedVersion: number, settings: Parameters<Gateway['saveSettings']>[1]) {
  const envelope = await this.api.request(this.base + '/settings', SettingsEnvelopeSchema, { method: 'PUT', body: { expectedVersion, settings }, signal: this.signal() });
  return this.guard(envelope, envelope.organizationId);
 }
 async uploadLogo(file: File) {
  const result = await this.api.request(this.base + '/logo', LogoResultSchema, { method: 'POST', raw: file, contentType: file.type, signal: this.signal(), timeoutMs: 30_000 });
  return this.guard({ assetId: result.assetId, previewUrl: result.url });
 }
 dispose() { this.lifetime.abort(); }
}
